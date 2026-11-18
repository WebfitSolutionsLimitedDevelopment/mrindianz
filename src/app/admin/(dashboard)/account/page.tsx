import { getAdminSession } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/admin/ui";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { PasswordForm } from "./password-form";

export default async function Account() {
  const s = await getAdminSession();
  return (
    <>
      <PageHeader title="My account" description={`${s?.email} · ${s?.roles.map((r) => ROLE_LABELS[r]).join(", ")}`} />
      <Card title="Password"><PasswordForm /></Card>
      <p className="mt-6 text-xs text-mist">Recommended: enable multi-factor authentication for all admin accounts in Supabase Auth settings before launch.</p>
    </>
  );
}
