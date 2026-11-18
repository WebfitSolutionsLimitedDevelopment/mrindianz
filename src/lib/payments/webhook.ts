import type Stripe from "stripe";

/**
 * Stripe webhook dispatcher. All state changes happen inside idempotent, transactional
 * PostgreSQL functions (see supabase/migrations/*_voting.sql). This module only maps
 * verified Stripe events to those functions, so it can be unit-tested with a fake `rpc`.
 */
export type Rpc = (fn: string, params: Record<string, unknown>) => Promise<string>;

export type WebhookOutcome = { httpStatus: 200 | 500; result: string; orderId?: string };

function piId(v: string | Stripe.PaymentIntent | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

export async function handleStripeEvent(event: Stripe.Event, rpc: Rpc): Promise<WebhookOutcome> {
  const mode = event.livemode ? "live" : "test";

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.kind !== "peoples_choice_vote" || !s.metadata.order_id) return { httpStatus: 200, result: "ignored:not_a_vote" };
      const result = await rpc("process_checkout_completed", {
        p_event_id: event.id, p_mode: mode, p_order_id: s.metadata.order_id, p_session_id: s.id,
        p_payment_intent_id: piId(s.payment_intent), p_payment_status: s.payment_status,
        p_amount_total: s.amount_total, p_currency: s.currency ?? "",
      });
      return { httpStatus: result === "retry" ? 500 : 200, result, orderId: s.metadata.order_id };
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.kind !== "peoples_choice_vote" || !s.metadata.order_id) return { httpStatus: 200, result: "ignored:not_a_vote" };
      const result = await rpc("process_checkout_failed", {
        p_event_id: event.id, p_event_type: event.type, p_mode: mode, p_order_id: s.metadata.order_id, p_session_id: s.id,
      });
      return { httpStatus: 200, result, orderId: s.metadata.order_id };
    }
    case "refund.created":
    case "refund.updated": {
      const r = event.data.object as Stripe.Refund;
      const pi = piId(r.payment_intent);
      if (!pi) return { httpStatus: 200, result: "ignored:no_payment_intent" };
      const result = await rpc("process_refund", {
        p_event_id: event.id, p_mode: mode, p_payment_intent_id: pi, p_refund_id: r.id,
        p_refund_amount_cents: r.amount, p_refund_status: r.status ?? "unknown",
      });
      return { httpStatus: result === "retry" ? 500 : 200, result };
    }
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed": {
      const d = event.data.object as Stripe.Dispute;
      const pi = piId(d.payment_intent);
      if (!pi) return { httpStatus: 200, result: "ignored:no_payment_intent" };
      const result = await rpc("process_dispute", {
        p_event_id: event.id, p_event_type: event.type, p_mode: mode, p_payment_intent_id: pi, p_dispute_id: d.id,
        p_dispute_status: d.status, p_amount_cents: d.amount, p_reason: d.reason,
      });
      return { httpStatus: result === "retry" ? 500 : 200, result };
    }
    default:
      return { httpStatus: 200, result: `ignored:${event.type}` };
  }
}
