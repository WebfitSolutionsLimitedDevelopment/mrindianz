import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createUserClient } from "@/lib/supabase/server";
import { AdminButton, Flash, PageHeader, StatusPill, Table, adminInput, td, th } from "@/components/admin/ui";
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/validation/admin";
import { formatNzDateTime } from "@/lib/format";
import { changeStatus } from "./actions";

const PAGE_SIZE = 50;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePermission("applications:read");
  const sp = await searchParams;
  const status = APPLICATION_STATUSES.includes(sp.status as ApplicationStatus) ? (sp.status as ApplicationStatus) : undefined;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const talent = sp.talent === "1";
  const page = Math.max(1, Number(sp.page) || 1);

  const db = await createUserClient();
  let query = db.from("applications")
    .select("id, reference, legal_name, stage_name, email, city, region, status, talent_audition, submitted_at, anonymised_at", { count: "exact" })
    .order("submitted_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (talent) query = query.eq("talent_audition", true);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`legal_name.ilike.%${safe}%,stage_name.ilike.%${safe}%,email.ilike.%${safe}%,reference.ilike.%${safe}%,city.ilike.%${safe}%`);
  }
  const { data, count, error } = await query;
  const canUpdate = can(session.roles, "applications:update");
  const exportHref = `/admin/applications/export?${new URLSearchParams({ ...(status ? { status } : {}), ...(talent ? { talent: "1" } : {}) })}`;
  const returnTo = `/admin/applications?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["ok", "error"].includes(k)) as [string, string][])}`;

  return (
    <>
      <PageHeader title="Applications" description="Applicant data is private. Do not share exports outside the selection team."
        actions={can(session.roles, "applications:export") ? <a href={exportHref} className="rounded border border-line px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-gold">Export CSV</a> : null} />
      <Flash ok={sp.ok} error={sp.error ?? (error ? "Could not load applications." : undefined)} />

      <form className="mb-6 flex flex-wrap items-end gap-3" role="search">
        <label className="space-y-1"><span className="block text-xs text-mist">Search</span><input name="q" defaultValue={q} placeholder="Name, email, reference, city" className={`${adminInput} w-64`} /></label>
        <label className="space-y-1"><span className="block text-xs text-mist">Status</span>
          <select name="status" defaultValue={status ?? ""} className={adminInput}>
            <option value="">All statuses</option>
            {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="talent" value="1" defaultChecked={talent} /> Mr. Talent only</label>
        <AdminButton type="submit" variant="secondary">Filter</AdminButton>
      </form>

      <form action={changeStatus}>
        <input type="hidden" name="returnTo" value={returnTo} />
        {canUpdate && (
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded border border-line bg-charcoal p-3">
            <span className="text-xs text-mist">Bulk action for selected:</span>
            <select name="status" className={`${adminInput} w-auto`} defaultValue="in_review" aria-label="New status">
              {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <input name="note" placeholder="Optional note" className={`${adminInput} w-56`} aria-label="Status note" />
            <AdminButton type="submit">Update status</AdminButton>
          </div>
        )}
        <Table>
          <thead>
            <tr>
              {canUpdate && <th className={th}><span className="sr-only">Select</span></th>}
              <th className={th}>Reference</th><th className={th}>Name</th><th className={th}>Location</th><th className={th}>Status</th><th className={th}>Talent</th><th className={th}>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-charcoal">
                {canUpdate && <td className={td}><input type="checkbox" name="applicationIds" value={a.id} aria-label={`Select ${a.reference}`} disabled={!!a.anonymised_at} /></td>}
                <td className={td}><Link href={`/admin/applications/${a.id}`} className="font-mono text-gold underline">{a.reference}</Link></td>
                <td className={td}>{a.legal_name}{a.stage_name && <span className="block text-xs text-mist">“{a.stage_name}”</span>}</td>
                <td className={td}>{a.city}, {a.region}</td>
                <td className={td}><StatusPill tone={a.status === "new" ? "gold" : a.status === "confirmed" ? "success" : a.status === "unsuccessful" || a.status === "withdrawn" ? "danger" : "neutral"}>{STATUS_LABELS[a.status as ApplicationStatus]}</StatusPill></td>
                <td className={td}>{a.talent_audition ? "Yes" : "—"}</td>
                <td className={td}>{formatNzDateTime(a.submitted_at)}</td>
              </tr>
            ))}
            {!data?.length && <tr><td className={td} colSpan={7}>No applications found.</td></tr>}
          </tbody>
        </Table>
      </form>
      <div className="mt-4 flex items-center justify-between text-sm text-mist">
        <span>{count ?? 0} total</span>
        <span className="flex gap-4">
          {page > 1 && <Link className="text-gold underline" href={`/admin/applications?${new URLSearchParams({ ...sp, page: String(page - 1) } as Record<string, string>)}`}>Previous</Link>}
          {(count ?? 0) > page * PAGE_SIZE && <Link className="text-gold underline" href={`/admin/applications?${new URLSearchParams({ ...sp, page: String(page + 1) } as Record<string, string>)}`}>Next</Link>}
        </span>
      </div>
    </>
  );
}
