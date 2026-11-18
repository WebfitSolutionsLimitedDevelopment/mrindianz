/**
 * Creates (or promotes) the first Super Admin. Run once per environment from a trusted machine:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/bootstrap-admin.ts admin@example.com
 * The user receives a Supabase invitation email to set their password (or reuse an existing account).
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (!email || !url || !key) {
    console.error("Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/bootstrap-admin.ts <email>");
    process.exit(1);
  }
  const db = createClient(url, key, { db: { schema: "mrindianz" }, auth: { persistSession: false } });
  const { data: list, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw listErr;
  let user = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${siteUrl}/admin/auth/callback?next=/admin/account` });
    if (error || !data.user) throw error ?? new Error("invite failed");
    user = data.user;
    console.log(`Invitation sent to ${email}.`);
  }
  await db.from("profiles").upsert({ id: user.id, email });
  const { error } = await db.from("admin_roles").upsert({ user_id: user.id, role: "super_admin" });
  if (error) throw error;
  console.log(`${email} is now a Super Admin.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
