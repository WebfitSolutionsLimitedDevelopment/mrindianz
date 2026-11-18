import { beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import type { PGlite } from "@electric-sql/pglite";
import { applySeed, createTestDb } from "./harness";
import { handleStripeEvent, type Rpc } from "@/lib/payments/webhook";

/**
 * Exercises the real webhook dispatcher against the real SQL functions (PGlite), with Stripe
 * signature verification done by the official Stripe library. No network calls are made.
 */
const stripe = new Stripe("sk_test_dummy_for_signature_only");
const WEBHOOK_SECRET = "whsec_test_secret_123";

let db: PGlite;
let rpc: Rpc;
let campaignId: string;
let contestantId: string;
let packageId: string;

function verify(payload: string, secret = WEBHOOK_SECRET, signWith = WEBHOOK_SECRET): Stripe.Event {
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: signWith });
  return stripe.webhooks.constructEvent(payload, header, secret);
}

function event(type: string, object: Record<string, unknown>, id = `evt_${crypto.randomUUID().replace(/-/g, "")}`) {
  return JSON.stringify({ id, object: "event", type, livemode: false, created: Math.floor(Date.now() / 1000), api_version: "2025-01-01", data: { object } });
}

async function newPaidOrderSession(qty = 1) {
  const r = await db.query<{ id: string; total_cents: number }>(
    `select * from mrindianz.create_voting_order($1, $2, $3, $4, $5, 'Ravi', 'ravi@example.com', true, 'draft-2026-11', 'test')`,
    [crypto.randomUUID(), campaignId, contestantId, packageId, qty]);
  const order = r.rows[0];
  const sessionId = `cs_test_${crypto.randomUUID().replace(/-/g, "")}`;
  await db.query(`select mrindianz.attach_checkout_session($1, $2)`, [order.id, sessionId]);
  return { order, sessionId, pi: `pi_${crypto.randomUUID().replace(/-/g, "")}` };
}

const netVotes = async (orderId: string) => (await db.query<{ v: number }>(`select mrindianz.order_net_votes($1) v`, [orderId])).rows[0].v;

beforeAll(async () => {
  db = await createTestDb();
  await applySeed(db);
  campaignId = (await db.query<{ id: string }>(`select id from voting_campaigns where slug = 'peoples-choice-2027'`)).rows[0].id;
  await db.query(`update voting_campaigns set status = 'open', opens_at = now() - interval '1 hour', closes_at = now() + interval '1 day' where id = $1`, [campaignId]);
  contestantId = (await db.query<{ id: string }>(`select id from contestants order by contestant_number limit 1`)).rows[0].id;
  packageId = (await db.query<{ id: string }>(`select id from voting_packages where campaign_id = $1 and name = 'Supporter'`, [campaignId])).rows[0].id;
  rpc = async (fn, params) => {
    const keys = Object.keys(params);
    const sql = `select mrindianz.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
    const res = await db.query<{ r: string }>(sql, keys.map((k) => params[k]));
    return String(res.rows[0].r);
  };
});

describe("Stripe signature verification", () => {
  it("rejects forged and unsigned payloads", () => {
    const payload = event("checkout.session.completed", { id: "cs_x" });
    expect(() => verify(payload, WEBHOOK_SECRET, "whsec_attacker")).toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, "t=1,v1=deadbeef", WEBHOOK_SECRET)).toThrow();
    expect(() => verify(payload.replace("cs_x", "cs_y"), WEBHOOK_SECRET)).not.toThrow();
  });
  it("rejects a payload modified after signing", () => {
    const payload = event("checkout.session.completed", { id: "cs_x", amount_total: 1000 });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    expect(() => stripe.webhooks.constructEvent(payload.replace("1000", "1"), header, WEBHOOK_SECRET)).toThrow();
  });
});

describe("webhook → ledger", () => {
  it("credits votes once for checkout.session.completed and ignores the duplicate delivery", async () => {
    const { order, sessionId, pi } = await newPaidOrderSession(2); // 2 × Supporter = $20 / 100 votes
    const payload = event("checkout.session.completed", {
      id: sessionId, object: "checkout.session", payment_status: "paid", amount_total: 2000, currency: "nzd", payment_intent: pi,
      metadata: { kind: "peoples_choice_vote", order_id: order.id },
    });
    const evt = verify(payload);
    expect(await handleStripeEvent(evt, rpc)).toMatchObject({ httpStatus: 200, result: "processed" });
    expect(await handleStripeEvent(evt, rpc)).toMatchObject({ httpStatus: 200, result: "duplicate" });
    expect(await netVotes(order.id)).toBe(100);
  });

  it("never credits a session whose amount was tampered with", async () => {
    const { order, sessionId, pi } = await newPaidOrderSession();
    const evt = verify(event("checkout.session.completed", { id: sessionId, payment_status: "paid", amount_total: 1, currency: "nzd", payment_intent: pi, metadata: { kind: "peoples_choice_vote", order_id: order.id } }));
    expect((await handleStripeEvent(evt, rpc)).result).toBe("rejected:amount_mismatch");
    expect(await netVotes(order.id)).toBe(0);
  });

  it("marks expired and failed sessions without crediting", async () => {
    const { order, sessionId } = await newPaidOrderSession();
    const evt = verify(event("checkout.session.expired", { id: sessionId, metadata: { kind: "peoples_choice_vote", order_id: order.id } }));
    expect((await handleStripeEvent(evt, rpc)).result).toBe("processed");
    expect((await db.query<{ status: string }>(`select status from voting_orders where id = $1`, [order.id])).rows[0].status).toBe("expired");
  });

  it("handles out-of-order refund → retry (500) then success after payment arrives", async () => {
    const { order, sessionId, pi } = await newPaidOrderSession();
    const refund = verify(event("refund.created", { id: "re_ooo1", object: "refund", amount: 1000, status: "succeeded", payment_intent: pi }));
    expect(await handleStripeEvent(refund, rpc)).toMatchObject({ httpStatus: 500, result: "retry" });
    await handleStripeEvent(verify(event("checkout.session.completed", { id: sessionId, payment_status: "paid", amount_total: 1000, currency: "nzd", payment_intent: pi, metadata: { kind: "peoples_choice_vote", order_id: order.id } })), rpc);
    expect(await netVotes(order.id)).toBe(50);
    expect(await handleStripeEvent(refund, rpc)).toMatchObject({ httpStatus: 200, result: "processed" }); // Stripe retry of same event
    expect(await netVotes(order.id)).toBe(0);
  });

  it("reverses votes on dispute creation", async () => {
    const { order, sessionId, pi } = await newPaidOrderSession();
    await handleStripeEvent(verify(event("checkout.session.completed", { id: sessionId, payment_status: "paid", amount_total: 1000, currency: "nzd", payment_intent: pi, metadata: { kind: "peoples_choice_vote", order_id: order.id } })), rpc);
    const r = await handleStripeEvent(verify(event("charge.dispute.created", { id: "dp_w1", object: "dispute", amount: 1000, status: "needs_response", reason: "fraudulent", payment_intent: pi })), rpc);
    expect(r.result).toBe("processed");
    expect(await netVotes(order.id)).toBe(0);
  });

  it("ignores unrelated events and non-vote sessions", async () => {
    expect((await handleStripeEvent(verify(event("customer.created", { id: "cus_1" })), rpc)).result).toBe("ignored:customer.created");
    expect((await handleStripeEvent(verify(event("checkout.session.completed", { id: "cs_other", metadata: { kind: "contestant_fee" } })), rpc)).result).toBe("ignored:not_a_vote");
  });

  it("refuses a live-mode event for a test-mode order", async () => {
    const { order, sessionId, pi } = await newPaidOrderSession();
    const payload = event("checkout.session.completed", { id: sessionId, payment_status: "paid", amount_total: 1000, currency: "nzd", payment_intent: pi, metadata: { kind: "peoples_choice_vote", order_id: order.id } }).replace('"livemode":false', '"livemode":true');
    expect((await handleStripeEvent(verify(payload), rpc)).result).toBe("rejected:mode_mismatch");
    expect(await netVotes(order.id)).toBe(0);
  });
});
