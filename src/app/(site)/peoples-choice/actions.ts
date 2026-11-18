"use server";

import { voteCheckoutSchema } from "@/lib/validation/voting";
import { createServiceClient } from "@/lib/supabase/server";
import { demoVotingAllowed, getActiveCampaign } from "@/lib/voting/repo";
import { effectiveVotingState } from "@/lib/voting/state";
import { paymentReadiness } from "@/lib/payments/config";
import { getStripe } from "@/lib/payments/stripe";
import { rateLimit } from "@/lib/security";
import { absoluteUrl, contestantPath } from "@/lib/site";

export type CheckoutResult =
  | { status: "redirect"; url: string }
  | { status: "demo_complete"; orderRef: string; votes: number }
  | { status: "payments_disabled"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const ERROR_MESSAGES: Record<string, string> = {
  voting_not_open: "Voting is not open right now.",
  contestant_not_eligible: "This contestant is not currently accepting votes.",
  package_not_available: "That voting package is no longer available.",
  invalid_quantity: "Please choose a valid quantity.",
  terms_version_mismatch: "The voting rules have been updated. Please refresh the page and accept the latest rules.",
  payment_mode_mismatch: "Voting is not available in this environment.",
};

/**
 * Creates a server-priced order and (when payments are enabled) a Stripe Checkout Session.
 * The browser only sends identifiers and a quantity; price and votes come from the database.
 */
export async function startVoteCheckout(raw: unknown): Promise<CheckoutResult> {
  const parsed = voteCheckoutSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { status: "error", message: "Please check your details.", fieldErrors };
  }
  const input = parsed.data;

  const campaign = await getActiveCampaign();
  if (!campaign || campaign.id !== input.campaignId) return { status: "error", message: "This voting campaign is not available." };
  if (effectiveVotingState(campaign) !== "open") return { status: "error", message: "Voting is not open right now." };

  const isDemo = campaign.is_demo;
  if (isDemo && !demoVotingAllowed()) return { status: "error", message: "Voting is not available." };
  const readiness = paymentReadiness();
  if (!isDemo && !readiness.ready) {
    return { status: "payments_disabled", message: "Secure payments are coming soon. No payment has been taken and no votes have been recorded." };
  }

  if (!(await rateLimit("vote-checkout", 20, 600))) return { status: "error", message: "Too many attempts. Please wait a few minutes." };

  const db = createServiceClient();
  if (!db) return { status: "error", message: "Voting is temporarily unavailable." };

  const mode = isDemo ? "demo" : readiness.ready ? readiness.mode : "test";
  const { data: order, error } = await db.rpc("create_voting_order", {
    p_idempotency_key: input.idempotencyKey,
    p_campaign_id: campaign.id,
    p_contestant_id: input.contestantId,
    p_package_id: input.packageId,
    p_quantity: input.quantity,
    p_supporter_name: input.supporterName,
    p_supporter_email: input.supporterEmail,
    p_display_anonymously: input.displayAnonymously,
    p_terms_version: campaign.rules_version,
    p_payment_mode: mode,
  }).single<{ id: string; public_ref: string; status: string; total_cents: number; total_votes: number; currency: string; stripe_checkout_session_id: string | null; contestant_id: string }>();

  if (error || !order) {
    const code = Object.keys(ERROR_MESSAGES).find((k) => error?.message?.includes(k));
    return { status: "error", message: code ? ERROR_MESSAGES[code] : "We couldn't start your order. Please try again." };
  }

  if (isDemo) {
    const { data: result, error: demoErr } = await db.rpc("complete_demo_order", { p_order_id: order.id });
    if (demoErr) return { status: "error", message: "Demo vote could not be recorded." };
    return { status: "demo_complete", orderRef: order.public_ref, votes: result === "processed" || result === "duplicate" ? order.total_votes : 0 };
  }

  // Retry of the same idempotency key after the session was created: reuse it.
  const stripe = getStripe();
  if (order.stripe_checkout_session_id) {
    const existing = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
    if (existing.status === "open" && existing.url) return { status: "redirect", url: existing.url };
    return { status: "error", message: "This order has already been processed. Please start a new vote." };
  }

  const { data: item } = await db.from("voting_order_items").select("package_name, quantity, unit_price_cents, votes_per_unit").eq("order_id", order.id).single();
  const { data: contestant } = await db.from("contestants").select("slug, public_name").eq("id", order.contestant_id).single();
  if (!item || !contestant) return { status: "error", message: "We couldn't start your order. Please try again." };

  // Stripe requires 30 min – 24 h. Orders must be started while voting is open (enforced in create_voting_order).
  const expiresAt = Math.floor((Date.now() + 31 * 60_000) / 1000);

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: input.supporterEmail,
      client_reference_id: order.id,
      line_items: [{
        quantity: item.quantity,
        price_data: {
          currency: order.currency.toLowerCase(),
          unit_amount: item.unit_price_cents,
          product_data: {
            name: `People's Choice — ${item.package_name} (${item.votes_per_unit} votes)`,
            description: `Votes for ${contestant.public_name}. Votes are credited after payment is verified.`,
          },
        },
      }],
      metadata: { kind: "peoples_choice_vote", order_id: order.id, order_ref: order.public_ref },
      payment_intent_data: { metadata: { kind: "peoples_choice_vote", order_id: order.id } },
      success_url: absoluteUrl("/peoples-choice/thank-you?session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: absoluteUrl(`${contestantPath(contestant.slug)}?checkout=cancelled#vote`),
      expires_at: expiresAt,
    },
    { idempotencyKey: `vote-checkout-${order.id}` },
  );

  if (session.amount_total !== order.total_cents) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    return { status: "error", message: "Price verification failed. No payment was taken." };
  }
  const { error: attachErr } = await db.rpc("attach_checkout_session", { p_order_id: order.id, p_session_id: session.id });
  if (attachErr || !session.url) return { status: "error", message: "We couldn't start your payment. Please try again." };
  return { status: "redirect", url: session.url };
}
