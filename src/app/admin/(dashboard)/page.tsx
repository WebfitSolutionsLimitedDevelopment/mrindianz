import Link from "next/link";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createUserClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, StatusPill, Table, td, th } from "@/components/admin/ui";
import { formatCents, formatNzDateTime } from "@/lib/format";
import { leaderboardMode, activeCampaignSlug } from "@/lib/voting/repo";
import { effectiveVotingState, VOTING_STATE_LABELS } from "@/lib/voting/state";
import { paymentReadiness } from "@/lib/payments/config";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/validation/admin";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const [session, sp] = await Promise.all([getAdminSession(), searchParams]);
  if (!session) return null;
  const db = await createUserClient();
  const mode = leaderboardMode();

  const showApps = can(session.roles, "applications:read");
  const showFinance = can(session.roles, "finance:read");
  const showContestants = can(session.roles, "contestants:read");

  const count = async (table: string, eq?: [string, string]) => {
    const base = db.from(table).select("id", { count: "exact", head: true });
    const { count: c } = eq ? await base.eq(eq[0], eq[1]) : await base;
    return c ?? 0;
  };

  const showContact = can(session.roles, "contact:read");
  const [total, fresh, shortlisted, confirmed, published, finance, orders, campaign, activity, newEnquiries, partnerEnquiries] = await Promise.all([
    showApps ? count("applications") : null,
    showApps ? count("applications", ["status", "new"]) : null,
    showApps ? count("applications", ["status", "shortlisted"]) : null,
    showApps ? count("applications", ["status", "confirmed"]) : null,
    showContestants ? count("contestants", ["publication_status", "published"]) : null,
    showFinance ? db.rpc("admin_finance_summary", { p_mode: mode }).single<{ verified_votes: number; gross_cents: number; refunded_cents: number; paid_orders: number; pending_orders: number; disputed_orders: number }>() : null,
    showFinance ? db.from("voting_orders").select("public_ref, status, total_cents, total_votes, payment_mode, created_at, contestants(public_name)").order("created_at", { ascending: false }).limit(6) : null,
    db.from("voting_campaigns").select("name, status, opens_at, closes_at").eq("slug", activeCampaignSlug()).maybeSingle(),
    can(session.roles, "audit:read") ? db.from("audit_logs").select("action, entity_type, entity_id, created_at").order("created_at", { ascending: false }).limit(8) : null,
    showContact ? count("contact_submissions", ["status", "new"]) : null,
    showContact ? db.from("contact_submissions").select("id", { count: "exact", head: true }).like("subject", "[Sponsorship & partnership]%").neq("status", "archived").then((r) => r.count ?? 0) : null,
  ]);

  const fin = finance?.data;
  const payments = paymentReadiness();

  return (
    <>
      <PageHeader title="Overview" description="Live figures from the database. Financial figures count verified ledger entries only." />
      {sp.denied && <p role="alert" className="mb-6 rounded border border-danger/60 p-3 text-sm text-danger">You don&apos;t have permission to open that page.</p>}

      {showApps && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total applications" value={total} href="/admin/applications" />
          <Stat label="New applications" value={fresh} href="/admin/applications?status=new" />
          <Stat label="Shortlisted" value={shortlisted} href="/admin/applications?status=shortlisted" />
          <Stat label="Confirmed contestants" value={confirmed} href="/admin/applications?status=confirmed" />
        </div>
      )}
      {showContact && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="New enquiries" value={newEnquiries} href="/admin/messages" />
          <Stat label="Sponsorship & partner enquiries" value={partnerEnquiries} href={`/admin/messages?type=${encodeURIComponent("Sponsorship & partnership")}`} />
        </div>
      )}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showContestants && <Stat label="Published profiles" value={published} href="/admin/contestants" />}
        {fin && (
          <>
            <Stat label="Verified votes" value={Number(fin.verified_votes).toLocaleString("en-NZ")} note={`${mode} mode`} />
            <Stat label="Gross voting revenue" value={formatCents(Number(fin.gross_cents))} />
            <Stat label="Refunds" value={formatCents(Number(fin.refunded_cents))} note={`${fin.disputed_orders} disputed orders`} />
            <Stat label="Net revenue" value={formatCents(Number(fin.gross_cents) - Number(fin.refunded_cents))} note="Before Stripe fees" />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Voting status">
          {campaign.data ? (
            <div className="space-y-2 text-sm">
              <p className="text-lg">{campaign.data.name}</p>
              <p><StatusPill tone={effectiveVotingState(campaign.data) === "open" ? "success" : "gold"}>{VOTING_STATE_LABELS[effectiveVotingState(campaign.data)]}</StatusPill></p>
              <p className="text-mist">Opens {formatNzDateTime(campaign.data.opens_at)} · Closes {formatNzDateTime(campaign.data.closes_at)}</p>
              <p className="text-mist">Payments: {payments.ready ? <span className="text-success">enabled ({payments.mode})</span> : <span className="text-gold">disabled — {payments.reason}</span>}</p>
            </div>
          ) : <p className="text-sm text-mist">No campaign configured.</p>}
        </Card>

        {orders && (
          <Card title="Recent transactions" actions={<Link href="/admin/transactions" className="text-xs text-gold underline">All</Link>}>
            {orders.data?.length ? (
              <Table>
                <thead><tr><th className={th}>Ref</th><th className={th}>Contestant</th><th className={th}>Status</th><th className={th}>Amount</th><th className={th}>When</th></tr></thead>
                <tbody>
                  {orders.data.map((o) => (
                    <tr key={o.public_ref}>
                      <td className={td}>{o.public_ref}<span className="ml-1 text-xs text-mist">{o.payment_mode}</span></td>
                      <td className={td}>{(o.contestants as unknown as { public_name: string } | null)?.public_name}</td>
                      <td className={td}><StatusPill tone={o.status === "paid" ? "success" : o.status === "disputed" || o.status === "review_required" ? "danger" : "neutral"}>{o.status}</StatusPill></td>
                      <td className={td}>{formatCents(o.total_cents)}</td>
                      <td className={td}>{formatNzDateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <p className="text-sm text-mist">No transactions yet.</p>}
          </Card>
        )}

        {activity && (
          <Card title="Recent activity" actions={<Link href="/admin/audit" className="text-xs text-gold underline">Audit log</Link>}>
            <ul className="space-y-2 text-sm">
              {(activity.data ?? []).map((a, i) => (
                <li key={i} className="flex justify-between gap-4"><span>{a.action} · {a.entity_type}{a.entity_type === "applications" && a.entity_id ? "" : a.entity_id ? ` · ${String(a.entity_id).slice(0, 8)}` : ""}</span><span className="text-mist">{formatNzDateTime(a.created_at)}</span></li>
              ))}
              {!activity.data?.length && <li className="text-mist">No activity yet.</li>}
            </ul>
          </Card>
        )}

        {showApps && (
          <Card title="Application pipeline">
            <p className="text-sm text-mist">Statuses: {Object.values(STATUS_LABELS as Record<ApplicationStatus, string>).join(" → ")}</p>
          </Card>
        )}
      </div>
    </>
  );
}
