import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { applySeed, createTestDb } from "./harness";

let db: PGlite;
let demoCampaign: string;
let liveCampaign: string;
let contestants: string[];
let starter: string; // demo 400c / 20 votes
let livePkg: string;

async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  return r.rows[0];
}

async function createOrder(opts: { campaign?: string; contestant?: string; pkg?: string; qty?: number; mode?: string; key?: string } = {}) {
  return one<{ id: string; total_cents: number; total_votes: number; status: string }>(
    `select * from mrindianz.create_voting_order($1, $2, $3, $4, $5, 'Asha Supporter', 'Asha@Example.com', false, 'draft-2026-11', $6)`,
    [opts.key ?? crypto.randomUUID(), opts.campaign ?? demoCampaign, opts.contestant ?? contestants[0], opts.pkg ?? starter,
     opts.qty ?? 1, opts.mode ?? "demo"],
  );
}

async function payLive(orderId: string, eventId = `evt_${crypto.randomUUID()}`, amount?: number, pi = `pi_${crypto.randomUUID()}`) {
  const session = `cs_${orderId}`;
  await db.query(`update mrindianz.voting_orders set stripe_checkout_session_id = null where id = $1 and status = 'pending'`, [orderId]);
  const o = await one<{ status: string; total_cents: number; stripe_checkout_session_id: string | null }>(`select * from mrindianz.voting_orders where id = $1`, [orderId]);
  if (!o.stripe_checkout_session_id) await db.query(`select mrindianz.attach_checkout_session($1, $2)`, [orderId, session]);
  const res = await one<{ r: string }>(
    `select mrindianz.process_checkout_completed($1, 'test', $2, $3, $4, 'paid', $5, 'nzd') as r`,
    [eventId, orderId, session, pi, amount ?? o.total_cents],
  );
  return { result: res.r, pi, session };
}

async function tally(campaign: string, mode = "test") {
  const r = await db.query<{ slug: string; votes: number | null; rank: number | null }>(
    `select slug, votes::int as votes, rank::int as rank from mrindianz.public_leaderboard($1, $2)`, [campaign, mode]);
  return r.rows;
}

beforeAll(async () => {
  db = await createTestDb();
  await applySeed(db);
  demoCampaign = (await one<{ id: string }>(`select id from voting_campaigns where slug = 'demo-peoples-choice'`)).id;
  liveCampaign = (await one<{ id: string }>(`select id from voting_campaigns where slug = 'peoples-choice-2027'`)).id;
  await db.query(`update voting_campaigns set status = 'open', opens_at = now() - interval '1 hour', closes_at = now() + interval '1 day' where id = $1`, [liveCampaign]);
  contestants = (await db.query<{ id: string }>(`select id from contestants order by contestant_number`)).rows.map((r) => r.id);
  starter = (await one<{ id: string }>(`select id from voting_packages where campaign_id = $1 and name = 'Starter'`, [demoCampaign])).id;
  livePkg = (await one<{ id: string }>(`select id from voting_packages where campaign_id = $1 and name = 'Champion'`, [liveCampaign])).id;
});

describe("order creation", () => {
  it("takes price and votes from the database, not the caller", async () => {
    const o = await createOrder({ qty: 3 });
    expect(o.total_cents).toBe(1200);
    expect(o.total_votes).toBe(60);
    expect(o.status).toBe("pending");
  });

  it("is idempotent on the idempotency key", async () => {
    const key = crypto.randomUUID();
    const a = await createOrder({ key });
    const b = await createOrder({ key, qty: 5 });
    expect(b.id).toBe(a.id);
    expect(b.total_votes).toBe(20);
  });

  it("rejects quantities above the configured maximum and below 1", async () => {
    await expect(createOrder({ qty: 11 })).rejects.toThrow(/invalid_quantity/);
    await expect(createOrder({ qty: 0 })).rejects.toThrow(/invalid_quantity/);
  });

  it("rejects a package from another campaign", async () => {
    await expect(createOrder({ pkg: livePkg })).rejects.toThrow(/package_not_available/);
  });

  it("rejects disabled packages", async () => {
    await db.query(`update voting_packages set is_active = false where id = $1`, [starter]);
    await expect(createOrder()).rejects.toThrow(/package_not_available/);
    await db.query(`update voting_packages set is_active = true where id = $1`, [starter]);
  });

  it("rejects demo orders on a real campaign and real orders on the demo campaign", async () => {
    await expect(createOrder({ campaign: liveCampaign, pkg: livePkg, mode: "demo" })).rejects.toThrow(/payment_mode_mismatch/);
    await expect(createOrder({ mode: "live" })).rejects.toThrow(/payment_mode_mismatch/);
  });

  it("rejects unpublished or non-eligible contestants", async () => {
    await db.query(`update contestants set voting_eligible = false where id = $1`, [contestants[5]]);
    await expect(createOrder({ contestant: contestants[5] })).rejects.toThrow(/contestant_not_eligible/);
    await db.query(`update contestants set voting_eligible = true where id = $1`, [contestants[5]]);
  });

  it("enforces paused, closed and scheduled voting states on the backend", async () => {
    for (const status of ["paused", "closed", "scheduled", "finalised", "draft"]) {
      await db.query(`update voting_campaigns set status = $2 where id = $1`, [demoCampaign, status]);
      await expect(createOrder()).rejects.toThrow(/voting_not_open/);
    }
    await db.query(`update voting_campaigns set status = 'open', closes_at = now() - interval '1 minute', opens_at = now() - interval '2 days' where id = $1`, [demoCampaign]);
    await expect(createOrder()).rejects.toThrow(/voting_not_open/);
    await db.query(`update voting_campaigns set closes_at = now() + interval '30 days' where id = $1`, [demoCampaign]);
    await expect(createOrder()).resolves.toBeTruthy();
  });

  it("rejects mismatched terms version", async () => {
    await expect(db.query(
      `select mrindianz.create_voting_order($1, $2, $3, $4, 1, 'A', 'a@b.co', false, 'old-version', 'demo')`,
      [crypto.randomUUID(), demoCampaign, contestants[0], starter])).rejects.toThrow(/terms_version_mismatch/);
  });
});

describe("payment processing and vote ledger", () => {
  it("credits votes exactly once for a verified payment, even with duplicate webhook events", async () => {
    const o = await createOrder({ campaign: liveCampaign, pkg: livePkg, contestant: contestants[1], mode: "test" });
    const before = (await tally(liveCampaign)).find((r) => r.slug === "demo-contestant-02")!.votes;
    const evt = `evt_${crypto.randomUUID()}`;
    const first = await payLive(o.id, evt);
    expect(first.result).toBe("processed");
    // same event delivered again
    const again = await one<{ r: string }>(`select mrindianz.process_checkout_completed($1, 'test', $2, $3, $4, 'paid', $5, 'nzd') as r`, [evt, o.id, first.session, first.pi, 2200]);
    expect(again.r).toBe("duplicate");
    // a different event id for the same order (e.g. async_payment_succeeded after completed)
    const other = await one<{ r: string }>(`select mrindianz.process_checkout_completed($1, 'test', $2, $3, $4, 'paid', $5, 'nzd') as r`, [`evt_${crypto.randomUUID()}`, o.id, first.session, first.pi, 2200]);
    expect(other.r).toBe("duplicate");
    const after = (await tally(liveCampaign)).find((r) => r.slug === "demo-contestant-02")!.votes;
    expect((after ?? 0) - (before ?? 0)).toBe(120);
    const credits = await one<{ n: number }>(`select count(*)::int as n from vote_ledger where order_id = $1`, [o.id]);
    expect(credits.n).toBe(1);
  });

  it("does not credit when the paid amount does not match the server order total (tampering)", async () => {
    const o = await createOrder({ campaign: liveCampaign, pkg: livePkg, mode: "test" });
    const r = await payLive(o.id, undefined, 1);
    expect(r.result).toBe("rejected:amount_mismatch");
    const st = await one<{ status: string }>(`select status from voting_orders where id = $1`, [o.id]);
    expect(st.status).toBe("review_required");
    expect((await one<{ n: number }>(`select count(*)::int n from vote_ledger where order_id = $1`, [o.id])).n).toBe(0);
  });

  it("rejects a session id that does not belong to the order", async () => {
    const o = await createOrder({ campaign: liveCampaign, pkg: livePkg, mode: "test" });
    await db.query(`select mrindianz.attach_checkout_session($1, $2)`, [o.id, `cs_real_${o.id}`]);
    const r = await one<{ r: string }>(`select mrindianz.process_checkout_completed($1, 'test', $2, 'cs_forged', null, 'paid', 2200, 'nzd') as r`, [`evt_${crypto.randomUUID()}`, o.id]);
    expect(r.r).toBe("rejected:session_mismatch");
  });

  it("does not count pending, failed or expired orders", async () => {
    const o = await createOrder({ campaign: liveCampaign, pkg: livePkg, contestant: contestants[2], mode: "test" });
    await db.query(`select mrindianz.attach_checkout_session($1, $2)`, [o.id, `cs_${o.id}`]);
    const r = await one<{ r: string }>(`select mrindianz.process_checkout_failed($1, 'checkout.session.expired', 'test', $2, $3) as r`, [`evt_${crypto.randomUUID()}`, o.id, `cs_${o.id}`]);
    expect(r.r).toBe("processed");
    expect((await one<{ status: string }>(`select status from voting_orders where id = $1`, [o.id])).status).toBe("expired");
    expect((await tally(liveCampaign)).find((x) => x.slug === "demo-contestant-03")!.votes).toBe(0);
  });

  it("does not credit asynchronous payments that are not yet paid", async () => {
    const o = await createOrder({ campaign: liveCampaign, pkg: livePkg, mode: "test" });
    await db.query(`select mrindianz.attach_checkout_session($1, $2)`, [o.id, `cs_${o.id}`]);
    const r = await one<{ r: string }>(`select mrindianz.process_checkout_completed($1, 'test', $2, $3, null, 'unpaid', 2200, 'nzd') as r`, [`evt_${crypto.randomUUID()}`, o.id, `cs_${o.id}`]);
    expect(r.r).toBe("ignored");
  });

  it("reverses votes on partial and full refunds via auditable ledger entries", async () => {
    const o = await createOrder({ campaign: liveCampaign, pkg: livePkg, contestant: contestants[3], qty: 2, mode: "test" }); // 4400c, 240 votes
    const { pi } = await payLive(o.id);
    const partial = await one<{ r: string }>(`select mrindianz.process_refund($1, 'test', $2, 're_1', 1100, 'succeeded') as r`, [`evt_${crypto.randomUUID()}`, pi]);
    expect(partial.r).toBe("processed");
    expect((await one<{ v: number }>(`select mrindianz.order_net_votes($1) v`, [o.id])).v).toBe(180);
    expect((await one<{ status: string }>(`select status from voting_orders where id = $1`, [o.id])).status).toBe("partially_refunded");
    // duplicate refund event with a new event id but same refund id
    const dup = await one<{ r: string }>(`select mrindianz.process_refund($1, 'test', $2, 're_1', 1100, 'succeeded') as r`, [`evt_${crypto.randomUUID()}`, pi]);
    expect(dup.r).toBe("duplicate");
    await db.query(`select mrindianz.process_refund($1, 'test', $2, 're_2', 3300, 'succeeded')`, [`evt_${crypto.randomUUID()}`, pi]);
    expect((await one<{ v: number }>(`select mrindianz.order_net_votes($1) v`, [o.id])).v).toBe(0);
    expect((await one<{ status: string }>(`select status from voting_orders where id = $1`, [o.id])).status).toBe("refunded");
    const entries = await db.query(`select entry_type, votes from vote_ledger where order_id = $1 order by created_at`, [o.id]);
    expect(entries.rows.length).toBe(3);
  });

  it("asks Stripe to retry a refund that arrives before the payment is recorded (out of order)", async () => {
    const evt = `evt_${crypto.randomUUID()}`;
    const r = await one<{ r: string }>(`select mrindianz.process_refund($1, 'test', 'pi_unknown', 're_x', 100, 'succeeded') as r`, [evt]);
    expect(r.r).toBe("retry");
    const again = await one<{ r: string }>(`select mrindianz.process_refund($1, 'test', 'pi_unknown', 're_x', 100, 'succeeded') as r`, [evt]);
    expect(again.r).toBe("retry"); // still retryable, not swallowed as duplicate
  });

  it("reverses on dispute and reinstates once if the dispute is won", async () => {
    const o = await createOrder({ campaign: liveCampaign, pkg: livePkg, contestant: contestants[4], mode: "test" });
    const { pi } = await payLive(o.id);
    await db.query(`select mrindianz.process_dispute($1, 'charge.dispute.created', 'test', $2, 'dp_1', 'needs_response', 2200, 'fraudulent')`, [`evt_${crypto.randomUUID()}`, pi]);
    expect((await one<{ v: number }>(`select mrindianz.order_net_votes($1) v`, [o.id])).v).toBe(0);
    await db.query(`select mrindianz.process_dispute($1, 'charge.dispute.closed', 'test', $2, 'dp_1', 'won', 2200, 'fraudulent')`, [`evt_${crypto.randomUUID()}`, pi]);
    await db.query(`select mrindianz.process_dispute($1, 'charge.dispute.closed', 'test', $2, 'dp_1', 'won', 2200, 'fraudulent')`, [`evt_${crypto.randomUUID()}`, pi]);
    expect((await one<{ v: number }>(`select mrindianz.order_net_votes($1) v`, [o.id])).v).toBe(120);
  });

  it("keeps the ledger append-only", async () => {
    await expect(db.query(`update vote_ledger set votes = 99999`)).rejects.toThrow(/append-only/);
    await expect(db.query(`delete from vote_ledger`)).rejects.toThrow(/append-only/);
    await expect(db.query(`delete from voting_orders`)).rejects.toThrow(/append-only/);
  });

  it("handles concurrent payments for the same contestant without losing votes", async () => {
    const orders = await Promise.all(Array.from({ length: 5 }, () => createOrder({ campaign: liveCampaign, pkg: livePkg, contestant: contestants[5], mode: "test" })));
    const before = (await tally(liveCampaign)).find((r) => r.slug === "demo-contestant-06")!.votes ?? 0;
    await Promise.all(orders.map((o) => payLive(o.id)));
    const after = (await tally(liveCampaign)).find((r) => r.slug === "demo-contestant-06")!.votes ?? 0;
    expect(after - before).toBe(600);
  });
});

describe("leaderboard", () => {
  it("separates demo votes from test/live votes", async () => {
    const o = await createOrder({ contestant: contestants[0], qty: 10 });
    expect((await one<{ r: string }>(`select mrindianz.complete_demo_order($1) r`, [o.id])).r).toBe("processed");
    const demo = await tally(demoCampaign, "live");
    expect(demo.find((r) => r.slug === "demo-contestant-01")!.votes).toBe(200);
    const live = await tally(liveCampaign, "live");
    expect(live.every((r) => r.votes === 0)).toBe(true); // all prior payments were 'test' mode
    await expect(db.query(`select mrindianz.complete_demo_order($1)`, [(await createOrder({ campaign: liveCampaign, pkg: livePkg, mode: "test" })).id])).rejects.toThrow(/not_a_demo_order/);
  });

  it("assigns tied ranks", async () => {
    const rows = await tally(liveCampaign, "live");
    expect(new Set(rows.map((r) => r.rank))).toEqual(new Set([1]));
  });

  it("freezes totals at the freeze time and hides counts or rankings when configured", async () => {
    await db.query(`update voting_campaigns set leaderboard_frozen_at = now() - interval '1 day' where id = $1`, [liveCampaign]);
    expect((await tally(liveCampaign)).every((r) => r.votes === 0)).toBe(true);
    await db.query(`update voting_campaigns set leaderboard_frozen_at = null, show_vote_counts = false, show_rankings = false where id = $1`, [liveCampaign]);
    const hidden = await tally(liveCampaign);
    expect(hidden.every((r) => r.votes === null && r.rank === null)).toBe(true);
    expect((await one<{ t: number | null }>(`select mrindianz.public_vote_total($1, 'test') t`, [liveCampaign])).t).toBeNull();
    await db.query(`update voting_campaigns set show_vote_counts = true, show_rankings = true where id = $1`, [liveCampaign]);
  });

  it("voting history never exposes email or payment ids", async () => {
    const rows = (await db.query<Record<string, unknown>>(`select * from mrindianz.public_voting_history($1, 'live', 10)`, [demoCampaign])).rows;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(["approx_time", "contestant_name", "contestant_slug", "supporter", "votes"]);
      expect(JSON.stringify(r)).not.toMatch(/@|cs_|pi_/);
    }
  });
});

describe("rate limiting", () => {
  it("allows up to the limit within a window", async () => {
    const key = `t:${crypto.randomUUID()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) results.push((await one<{ ok: boolean }>(`select mrindianz.hit_rate_limit($1, 3600, 3) ok`, [key])).ok);
    expect(results).toEqual([true, true, true, false]);
  });
});
