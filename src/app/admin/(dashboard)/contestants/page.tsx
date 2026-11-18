import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createUserClient } from "@/lib/supabase/server";
import { Flash, PageHeader, StatusPill, Table, td, th } from "@/components/admin/ui";
import { formatNzDateTime } from "@/lib/format";

export default async function AdminContestants({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; q?: string }> }) {
  const session = await requirePermission("contestants:read");
  const sp = await searchParams;
  const db = await createUserClient();
  let q = db.from("contestants").select("id, slug, contestant_number, public_name, publication_status, voting_eligible, updated_at").order("contestant_number", { nullsFirst: false }).order("public_name");
  if (sp.q) q = q.ilike("public_name", `%${sp.q.replace(/[%,()]/g, " ").slice(0, 60)}%`);
  const { data } = await q;
  return (
    <>
      <PageHeader title="Contestants" description="Profiles are private drafts until published. Slugs are permanent so QR codes never break."
        actions={can(session.roles, "contestants:write") ? <Link href="/admin/contestants/new" className="rounded bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink">New contestant</Link> : null} />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4" role="search"><input name="q" defaultValue={sp.q} placeholder="Search by name" className="rounded border border-line bg-ink px-3 py-2 text-sm" aria-label="Search contestants" /></form>
      <Table>
        <thead><tr><th className={th}>No.</th><th className={th}>Name</th><th className={th}>Public URL</th><th className={th}>Status</th><th className={th}>Voting</th><th className={th}>Updated</th></tr></thead>
        <tbody>
          {(data ?? []).map((c) => (
            <tr key={c.id}>
              <td className={td}>{c.contestant_number ?? "—"}</td>
              <td className={td}><Link href={`/admin/contestants/${c.id}`} className="text-gold underline">{c.public_name}</Link></td>
              <td className={td}><span className="font-mono text-xs">/contestants/{c.slug}</span></td>
              <td className={td}><StatusPill tone={c.publication_status === "published" ? "success" : c.publication_status === "archived" ? "danger" : "gold"}>{c.publication_status}</StatusPill></td>
              <td className={td}>{c.voting_eligible ? "Eligible" : "—"}</td>
              <td className={td}>{formatNzDateTime(c.updated_at)}</td>
            </tr>
          ))}
          {!data?.length && <tr><td className={td} colSpan={6}>No contestants yet.</td></tr>}
        </tbody>
      </Table>
    </>
  );
}
