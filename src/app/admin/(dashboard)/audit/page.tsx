import { requirePermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import { PageHeader, Table, td, th } from "@/components/admin/ui";
import { formatNzDateTime } from "@/lib/format";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  await requirePermission("audit:read");
  const sp = await searchParams;
  const db = await createUserClient();
  let q = db.from("audit_logs").select("actor_id, action, entity_type, entity_id, details, created_at").order("created_at", { ascending: false }).limit(300);
  if (sp.entity && /^[a-z_]+$/.test(sp.entity)) q = q.eq("entity_type", sp.entity);
  const { data } = await q;
  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of administrative changes. Personal data values are never stored here — only which fields changed." />
      <Table>
        <thead><tr><th className={th}>When</th><th className={th}>Actor</th><th className={th}>Action</th><th className={th}>Entity</th><th className={th}>Details</th></tr></thead>
        <tbody>
          {(data ?? []).map((a, i) => (
            <tr key={i}>
              <td className={td}>{formatNzDateTime(a.created_at)}</td>
              <td className={td}><span className="font-mono text-xs">{a.actor_id ? String(a.actor_id).slice(0, 8) : "system"}</span></td>
              <td className={td}>{a.action}</td>
              <td className={td}>{a.entity_type}{a.entity_id ? <span className="block font-mono text-xs text-mist">{String(a.entity_id).slice(0, 36)}</span> : null}</td>
              <td className={td}><code className="text-xs text-mist">{JSON.stringify(a.details)}</code></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
