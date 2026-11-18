import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { applySeed, asRole, createAdmin, createTestDb } from "./harness";

let db: PGlite;
let appId: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  db = await createTestDb();
  await applySeed(db);
  for (const r of ["super_admin", "organiser_admin", "content_editor", "application_reviewer", "finance_viewer"]) {
    ids[r] = await createAdmin(db, [r]);
  }
  ids.none = await createAdmin(db, []);
  const r = await db.query<{ id: string }>(
    `insert into applications (client_submission_id, legal_name, date_of_birth, email, mobile, city, region, why_enter,
      kiwi_indian_meaning, talent_audition, consents, policy_versions)
     values ($1, 'Private Person', '2000-01-01', 'private@example.com', '0211234567', 'Auckland', 'Auckland', 'x', 'y', false,
      '{}'::jsonb, '{}'::jsonb) returning id`, [crypto.randomUUID()]);
  appId = r.rows[0].id;
  await db.query(`insert into contestants (slug, public_name, publication_status) values ('draft-person', 'Draft Person', 'draft')`);
});

describe("anonymous visitors", () => {
  it("cannot read any applicant data", async () => {
    await expect(asRole(db, "anon", null, (tx) => tx.query(`select * from applications`))).rejects.toThrow(/permission denied/);
    await expect(asRole(db, "anon", null, (tx) => tx.query(`select * from application_media`))).rejects.toThrow(/permission denied/);
    await expect(asRole(db, "anon", null, (tx) => tx.query(`insert into applications (client_submission_id) values (gen_random_uuid())`))).rejects.toThrow(/permission denied/);
  });

  it("sees only published contestants and only public columns", async () => {
    const rows = await asRole(db, "anon", null, (tx) => tx.query<{ slug: string }>(`select slug from contestants`));
    expect(rows.rows.map((r) => r.slug)).not.toContain("draft-person");
    expect(rows.rows.length).toBe(6);
    await expect(asRole(db, "anon", null, (tx) => tx.query(`select application_id from contestants`))).rejects.toThrow(/permission denied/);
  });

  it("cannot read or write financial records", async () => {
    for (const t of ["voting_orders", "vote_ledger", "payment_events", "payment_refunds", "payment_disputes"]) {
      await expect(asRole(db, "anon", null, (tx) => tx.query(`select * from ${t}`))).rejects.toThrow(/permission denied/);
    }
    await expect(asRole(db, "anon", null, (tx) => tx.query(`select mrindianz.complete_demo_order(gen_random_uuid())`))).rejects.toThrow(/permission denied/);
    await expect(asRole(db, "anon", null, (tx) => tx.query(
      `select mrindianz.create_voting_order(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1, 'a', 'a@b.co', false, 'x', 'live')`))).rejects.toThrow(/permission denied/);
  });

  it("cannot see draft voting campaigns but can read the public leaderboard of open ones", async () => {
    const r = await asRole(db, "anon", null, (tx) => tx.query<{ slug: string }>(`select slug from voting_campaigns`));
    expect(r.rows.map((x) => x.slug)).toEqual(["demo-peoples-choice"]);
    const lb = await asRole(db, "anon", null, (tx) => tx.query(`select * from public_leaderboard((select id from voting_campaigns where slug = 'demo-peoples-choice'), 'live')`));
    expect(lb.rows.length).toBe(6);
  });

  it("cannot read rate limits, email logs, audit logs or contact submissions", async () => {
    for (const t of ["rate_limits", "email_delivery_logs", "audit_logs", "contact_submissions", "admin_roles"]) {
      await expect(asRole(db, "anon", null, (tx) => tx.query(`select * from ${t}`))).rejects.toThrow(/permission denied/);
    }
  });
});

describe("admin roles (least privilege)", () => {
  const count = (role: string, sql: string) =>
    asRole(db, "authenticated", ids[role], (tx) => tx.query<{ n: number }>(sql)).then((r) => r.rows[0].n);

  it("only reviewers/organisers/super admins can read applications", async () => {
    expect(await count("application_reviewer", `select count(*)::int n from applications`)).toBe(1);
    expect(await count("organiser_admin", `select count(*)::int n from applications`)).toBe(1);
    expect(await count("super_admin", `select count(*)::int n from applications`)).toBe(1);
    expect(await count("finance_viewer", `select count(*)::int n from applications`)).toBe(0);
    expect(await count("content_editor", `select count(*)::int n from applications`)).toBe(0);
    expect(await count("none", `select count(*)::int n from applications`)).toBe(0);
  });

  it("reviewer status changes are recorded in history with the actor", async () => {
    await asRole(db, "authenticated", ids.application_reviewer, (tx) => tx.query(`update applications set status = 'in_review' where id = $1`, [appId]));
    const h = await db.query<{ to_status: string; changed_by: string }>(`select to_status, changed_by from application_status_history where application_id = $1 order by changed_at`, [appId]);
    expect(h.rows.map((r) => r.to_status)).toEqual(["new", "in_review"]);
    expect(h.rows[1].changed_by).toBe(ids.application_reviewer);
    const audit = await db.query(`select * from audit_logs where entity_type = 'applications' and actor_id = $1`, [ids.application_reviewer]);
    expect(audit.rows.length).toBe(1);
    expect(JSON.stringify(audit.rows[0])).not.toContain("private@example.com");
  });

  it("finance viewers cannot update applications", async () => {
    await asRole(db, "authenticated", ids.finance_viewer, (tx) => tx.query(`update applications set status = 'confirmed' where id = $1`, [appId]));
    expect((await db.query<{ status: string }>(`select status from applications where id = $1`, [appId])).rows[0].status).toBe("in_review");
  });

  it("only finance/organisers can read orders", async () => {
    expect(await count("finance_viewer", `select count(*)::int n from voting_orders`)).toBe(0);
    await expect(asRole(db, "authenticated", ids.finance_viewer, (tx) => tx.query(`insert into vote_ledger (campaign_id, contestant_id, entry_type, votes, payment_mode, source_ref) select c.id, k.id, 'admin_adjustment', 1000, 'live', 'x' from voting_campaigns c, contestants k limit 1`))).rejects.toThrow(/permission denied/);
    expect(await count("content_editor", `select count(*)::int n from voting_orders`)).toBe(0);
  });

  it("content editors cannot change voting packages", async () => {
    await asRole(db, "authenticated", ids.content_editor, (tx) => tx.query(`update voting_packages set price_cents = 1`));
    expect((await db.query<{ n: number }>(`select count(*)::int n from voting_packages where price_cents = 1`)).rows[0].n).toBe(0);
  });

  it("prevents role escalation by non-super admins", async () => {
    await expect(asRole(db, "authenticated", ids.organiser_admin, (tx) =>
      tx.query(`insert into admin_roles (user_id, role) values ($1, 'super_admin')`, [ids.organiser_admin]))).rejects.toThrow(/row-level security/);
    await expect(asRole(db, "authenticated", ids.none, (tx) =>
      tx.query(`insert into admin_roles (user_id, role) values ($1, 'organiser_admin')`, [ids.none]))).rejects.toThrow(/row-level security/);
    await asRole(db, "authenticated", ids.super_admin, (tx) =>
      tx.query(`insert into admin_roles (user_id, role) values ($1, 'content_editor')`, [ids.none]));
  });

  it("cannot remove the last super admin", async () => {
    await expect(db.query(`delete from admin_roles where role = 'super_admin'`)).rejects.toThrow(/last super_admin/);
  });

  it("contestant slugs are permanent", async () => {
    await expect(db.query(`update contestants set slug = 'new-slug' where slug = 'draft-person'`)).rejects.toThrow(/permanent/);
    await db.query(`update contestants set public_name = 'Renamed' where slug = 'draft-person'`);
  });

  it("partners must be confirmed before publication", async () => {
    await expect(db.query(`insert into partners (name, category, is_published, confirmed) values ('X', 'major', true, false)`)).rejects.toThrow(/partners_publish_requires_confirmation/);
  });

  it("anonymises an applicant on request (super admin only)", async () => {
    await expect(asRole(db, "authenticated", ids.application_reviewer, (tx) => tx.query(`select anonymise_application($1)`, [appId]))).rejects.toThrow(/forbidden/);
    await asRole(db, "authenticated", ids.super_admin, (tx) => tx.query(`select anonymise_application($1)`, [appId]));
    const r = await db.query<{ email: string; legal_name: string }>(`select email, legal_name from applications where id = $1`, [appId]);
    expect(r.rows[0].legal_name).toBe("Deleted applicant");
    expect(r.rows[0].email).not.toContain("private");
  });
});

describe("shared-project isolation", () => {
  it("does not touch other sites' tables in the public schema", async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int n from information_schema.tables where table_schema = 'public'`);
    expect(r.rows[0].n).toBe(2); // only the pre-existing stand-in tables
    const f = await db.query<{ n: number }>(`select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'`);
    expect(f.rows[0].n).toBe(0);
  });
  it("a signed-in user from another site gets nothing without a Mr. IndiaNZ role", async () => {
    const outsider = crypto.randomUUID();
    await db.query(`insert into auth.users (id, email) values ($1, 'misp-user@example.com')`, [outsider]);
    const n = await asRole(db, "authenticated", outsider, (tx) => tx.query<{ n: number }>(`select count(*)::int n from mrindianz.applications`));
    expect(n.rows[0].n).toBe(0);
  });
});
