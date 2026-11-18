import { revalidatePath } from "next/cache";
import { requirePermission, assertPermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createUserClient } from "@/lib/supabase/server";
import { AdminButton, AdminField, Card, Flash, PageHeader, StatusPill, Table, adminInput, td, th } from "@/components/admin/ui";
import { emailTemplateSchema } from "@/lib/validation/admin";
import { back, firstIssue } from "@/lib/admin/flash";
import { formatNzDateTime } from "@/lib/format";
import { serverEnv } from "@/lib/env";

async function saveTemplate(formData: FormData) {
  "use server";
  await assertPermission("email:write");
  const parsed = emailTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/email", { error: firstIssue(parsed.error) });
  const db = await createUserClient();
  const { error } = await db.from("email_templates").update({ subject: parsed.data.subject, body: parsed.data.body }).eq("key", parsed.data.key);
  if (error) back("/admin/email", { error: "Save failed." });
  revalidatePath("/admin/email");
  back("/admin/email", { ok: "Template saved." });
}

export default async function EmailAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requirePermission("email:read");
  const sp = await searchParams;
  const db = await createUserClient();
  const editable = can(session.roles, "email:write");
  const [{ data: templates }, logs] = await Promise.all([
    db.from("email_templates").select("*").order("name"),
    can(session.roles, "contact:read") ? db.from("email_delivery_logs").select("template_key, status, attempts, last_error, created_at, updated_at").order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: null }),
  ]);
  const env = serverEnv();
  return (
    <>
      <PageHeader title="Email" description={<>Templates use {"{{placeholders}}"}. Delivery: {env.RESEND_API_KEY && env.EMAIL_FROM ? <span className="text-success">Resend configured ({env.EMAIL_FROM})</span> : <span className="text-gold">not configured — messages are logged as “not_configured” and nothing is sent</span>}.</>} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="space-y-4">
        {(templates ?? []).map((t) => (
          <details key={t.key} className="rounded border border-line bg-charcoal p-4">
            <summary className="cursor-pointer text-sm"><strong>{t.name}</strong> <span className="text-mist">— {t.description}</span></summary>
            <form action={saveTemplate} className="mt-4 space-y-3">
              <input type="hidden" name="key" value={t.key} />
              <fieldset disabled={!editable} className="space-y-3">
                <AdminField label="Subject"><input name="subject" defaultValue={t.subject} className={adminInput} /></AdminField>
                <AdminField label="Body"><textarea name="body" defaultValue={t.body} rows={10} className={`${adminInput} font-mono`} /></AdminField>
                {editable && <AdminButton type="submit">Save template</AdminButton>}
              </fieldset>
            </form>
          </details>
        ))}
      </div>
      {logs.data && (
        <Card title="Delivery log (latest 50)" className="mt-8">
          <Table>
            <thead><tr><th className={th}>Template</th><th className={th}>Status</th><th className={th}>Attempts</th><th className={th}>Error</th><th className={th}>Created</th></tr></thead>
            <tbody>{logs.data.map((l, i) => <tr key={i}><td className={td}>{l.template_key}</td><td className={td}><StatusPill tone={l.status === "sent" ? "success" : l.status === "failed" ? "danger" : "gold"}>{l.status}</StatusPill></td><td className={td}>{l.attempts}</td><td className={td}>{l.last_error}</td><td className={td}>{formatNzDateTime(l.created_at)}</td></tr>)}</tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
