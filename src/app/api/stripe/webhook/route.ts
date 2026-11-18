import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/payments/stripe";
import { handleStripeEvent } from "@/lib/payments/webhook";
import { createServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { sendTemplatedEmail } from "@/lib/email/send";
import { formatCents } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Every request is signature-verified against STRIPE_WEBHOOK_SECRET using the raw body.
 * Votes are credited ONLY here (never from the success URL), inside idempotent database functions.
 */
export async function POST(req: Request) {
  const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const rpc = async (fn: string, params: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, params);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return String(data);
  };

  try {
    const outcome = await handleStripeEvent(event, rpc);
    if (outcome.result.startsWith("rejected")) console.warn(`[stripe] ${event.type} ${event.id} → ${outcome.result}`);
    if (outcome.orderId && (outcome.result === "processed")) await sendOrderEmail(event.type, outcome.orderId);
    return NextResponse.json({ received: true, result: outcome.result }, { status: outcome.httpStatus });
  } catch (e) {
    console.error(`[stripe] processing failed for ${event.type} ${event.id}: ${e instanceof Error ? e.message : e}`);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // Stripe will retry
  }
}

async function sendOrderEmail(eventType: string, orderId: string) {
  const db = createServiceClient();
  if (!db) return;
  const { data: o } = await db
    .from("voting_orders")
    .select("public_ref, supporter_name, supporter_email, total_cents, total_votes, status, contestants(public_name), voting_order_items(package_name, quantity)")
    .eq("id", orderId)
    .single();
  if (!o) return;
  const contestant = (o.contestants as unknown as { public_name: string } | null)?.public_name ?? "";
  const item = (o.voting_order_items as unknown as { package_name: string; quantity: number }[])[0];
  const vars = {
    supporter_name: o.supporter_name.split(" ")[0], contestant_name: contestant, order_ref: o.public_ref,
    package_name: item?.package_name, quantity: item?.quantity, votes: o.total_votes, amount: formatCents(o.total_cents),
  };
  if (o.status === "paid" && eventType.startsWith("checkout.session")) {
    await sendTemplatedEmail({ templateKey: "voting_receipt", to: o.supporter_email, vars, dedupeKey: `voting_receipt:${orderId}` });
  } else if (o.status === "failed" || o.status === "expired") {
    await sendTemplatedEmail({ templateKey: "voting_payment_failed", to: o.supporter_email, vars, dedupeKey: `voting_failed:${orderId}` });
  }
}
