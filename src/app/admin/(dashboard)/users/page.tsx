import { revalidatePath } from "next/cache";
import { requirePermission, assertPermission } from "@/lib/auth/session";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { AdminButton, AdminField, Card, Flash, PageHeader, Table, adminInput, td, th } from "@/components/admin/ui";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { adminInviteSchema } from "@/lib/validation/admin";
import { back, firstIssue } from "@/lib/admin/flash";
import { absoluteUrl } from "@/lib/site";
import { audit } from "@/lib/audit";

async function inviteAdmin(formData: FormData) {
  "use server";
  const session = await assertPermission("users:manage");
  const parsed = adminInviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/users", { error: firstIssue(parsed.error) });
  const service = createServiceClient();
  if (!service) back("/admin/users", { error: "Supabase is not configured." });
  // Find or invite the user (Supabase sends the invitation email).
  let userId: string | null = null;
  const { data: list } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  userId = list?.users.find((u) => u.email?.toLowerCase() === parsed.data.email)?.id ?? null;
  if (!userId) {
    const { data, error } = await service.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo: absoluteUrl("/admin/auth/callback?next=/admin/account") });
    if (error || !data.user) back("/admin/users", { error: `Invite failed: ${error?.message ?? "unknown"}` });
    userId = data.user.id;
    await service.from("profiles").upsert({ id: userId, email: parsed.data.email });
  }
  // Grant via the signed-in super admin's session so RLS (super_admin only) applies.
  const db = await createUserClient();
  const { error } = await db.from("admin_roles").upsert({ user_id: userId, role: parsed.data.role, granted_by: session.userId });
  if (error) back("/admin/users", { error: "Could not grant role." });
  await audit(session.userId, "role_granted", "admin_roles", userId, { role: parsed.data.role });
  revalidatePath("/admin/users");
  back("/admin/users", { ok: `${ROLE_LABELS[parsed.data.role]} granted to ${parsed.data.email}.` });
}

async function revokeRole(formData: FormData) {
  "use server";
  const session = await assertPermission("users:manage");
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role"));
  const db = await createUserClient();
  const { error } = await db.from("admin_roles").delete().eq("user_id", userId).eq("role", role);
  if (error) back("/admin/users", { error: error.message.includes("last super_admin") ? "You cannot remove the last Super Admin." : "Could not revoke role." });
  await audit(session.userId, "role_revoked", "admin_roles", userId, { role });
  back("/admin/users", { ok: "Role revoked." });
}

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission("users:manage");
  const sp = await searchParams;
  const db = await createUserClient();
  const { data: roles } = await db.from("admin_roles").select("user_id, role, granted_at");
  const service = createServiceClient();
  const { data: users } = service ? await service.auth.admin.listUsers({ page: 1, perPage: 1000 }) : { data: null };
  const email = (id: string) => users?.users.find((u) => u.id === id)?.email ?? id.slice(0, 8);
  return (
    <>
      <PageHeader title="Users & roles" description="Least privilege: grant only the roles each person needs. Only Super Admins can change roles." />
      <Flash ok={sp.ok} error={sp.error} />
      <Card title="Grant access" className="mb-6">
        <form action={inviteAdmin} className="flex flex-wrap items-end gap-3">
          <AdminField label="Email"><input name="email" type="email" required className={`${adminInput} w-72`} /></AdminField>
          <AdminField label="Role"><select name="role" className={adminInput}>{ADMIN_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></AdminField>
          <AdminButton type="submit">Invite / grant</AdminButton>
        </form>
      </Card>
      <Table>
        <thead><tr><th className={th}>User</th><th className={th}>Role</th><th className={th}>Granted</th><th className={th}></th></tr></thead>
        <tbody>
          {(roles ?? []).map((r) => (
            <tr key={`${r.user_id}-${r.role}`}>
              <td className={td}>{email(r.user_id)}</td><td className={td}>{ROLE_LABELS[r.role as keyof typeof ROLE_LABELS]}</td><td className={td}>{new Date(r.granted_at).toLocaleDateString("en-NZ")}</td>
              <td className={td}><form action={revokeRole}><input type="hidden" name="userId" value={r.user_id} /><input type="hidden" name="role" value={r.role} /><button className="text-xs text-danger underline">Revoke</button></form></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
