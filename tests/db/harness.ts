/**
 * Spins up an in-process PostgreSQL (PGlite) with minimal Supabase stand-ins (auth schema, roles)
 * and applies every migration in supabase/migrations (except storage, which needs Supabase Storage).
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', ''), 'anon') $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
`;

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const dir = join(process.cwd(), "supabase/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql") && !f.includes("_storage")).sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8").replace(/create extension if not exists pgcrypto[^;]*;/, "");
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
    }
  }
  return db;
}

export async function applySeed(db: PGlite) {
  await db.exec(readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8"));
}

/** Run `fn` as a given Postgres role with optional JWT subject, inside a transaction. */
export async function asRole<T>(db: PGlite, role: "anon" | "authenticated" | "service_role", sub: string | null,
  fn: (tx: Pick<PGlite, "query" | "exec">) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = JSON.stringify({ sub: sub ?? "", role });
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    await tx.exec(`set local role ${role}`);
    return fn(tx as unknown as Pick<PGlite, "query" | "exec">);
  });
}

export async function createAdmin(db: PGlite, roles: string[]): Promise<string> {
  const id = crypto.randomUUID();
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@example.test`]);
  for (const r of roles) await db.query(`insert into public.admin_roles (user_id, role) values ($1, $2)`, [id, r]);
  return id;
}
