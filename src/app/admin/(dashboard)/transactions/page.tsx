import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import { AdminButton, Card, PageHeader, Stat, StatusPill, Table, adminInput, td, th } from "@/components/admin/ui";
import { formatCents, formatNzDateTime } from "@/lib/format";
import { activeCampaignSlug, leaderboardMode } from "@/lib/voting/repo";

const STATUSES = ["pending", "awaiting_payment", "paid", "failed", "expired", "refunded", "partially_refunded", "disputed", "review_required"];

export default async function Transactions({ searchParams }: { searchParams: Promise<{ status?: string; mode?: string; q?: string }> }) {
  await requirePermission("finance:read");
  const sp = await searchParams;
  const mode = ["live", "test", "demo"].includes(sp.mode ?? "") ? sp.mode! : leaderboardMode();
  const db = await createUserClient();
  let q = db.from("voting_orders").select("id, public_ref, status, payment_mode, supporter_name, supporter_email, display_anonymously, total_cents, total_votes, created_at, paid_at, contestants(public_name), voting_order_items(package_name, quantity)")
    .eq("payment_mode", mode).order("created_at", { ascending: false }).limit(200);
  if (sp.status && STATUSES.includes(sp.status)) q = q.eq("status", sp.status);
  if (sp.q) q = q.or(`public_ref.ilike.%${sp.q.replace(/[%,()]/g, "").slice(0, 40)}%,supporter_email.ilike.%${sp.q.replace(/[%,()]/g, "").slice(0, 40)}%`);
  const { data: campaign } = await db.from("voting_campaigns").select("id").eq("slug", activeCampaignSlug()).maybeSingle();
  const [{ data: orders }, { data: summary }, { data: tallies }, { data: refunds }, { data: disputes }, { data: events }] = await Promise.all([
    q,
    db.rpc("admin_finance_summary", { p_mode: mode }).single<{ verified_votes: number; gross_cents: number; refunded_cents: number; paid_orders: number; pending_orders: number; disputed_orders: number }>(),
    campaign ? db.rpc("admin_contestant_tallies", { p_campaign_id: campaign.id, p_mode: mode }) : Promise.resolve({ data: [] as { contestant_id: string; public_name: string; credits: number; reversals: number; net: number }[] }),
    db.from("payment_refunds").select("stripe_refund_id, amount_cents, votes_reversed, status, created_at, voting_orders!inner(public_ref, payment_mode)").eq("voting_orders.payment_mode", mode).order("created_at", { ascending: false }).limit(50),
    db.from("payment_disputes").select("stripe_dispute_id, amount_cents, reason, status, votes_reversed, updated_at, voting_orders!inner(public_ref, payment_mode)").eq("voting_orders.payment_mode", mode).order("updated_at", { ascending: false }).limit(50),
    db.from("payment_events").select("stripe_event_id, event_type, processing_status, result, attempts, received_at").eq("payment_mode", mode === "demo" ? "demo" : mode).order("received_at", { ascending: false }).limit(30),
  ]);

  return (
    <>
      <PageHeader title="Transactions" description="Read-only. Votes and revenue are derived from verified payment events and the append-only vote ledger. Refunds and disputes are handled in Stripe and reconciled here automatically."
        actions={<a className="rounded border border-line px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-gold" href={`/admin/transactions/export?mode=${mode}`}>Export CSV</a>} />
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label className="space-y-1"><span className="block text-xs text-mist">Mode</span><select name="mode" defaultValue={mode} className={adminInput}><option value="live">Live</option><option value="test">Test</option><option value="demo">Demo</option></select></label>
        <label className="space-y-1"><span className="block text-xs text-mist">Status</span><select name="status" defaultValue={sp.status ?? ""} className={adminInput}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="space-y-1"><span className="block text-xs text-mist">Search</span><input name="q" defaultValue={sp.q} placeholder="Order ref or email" className={adminInput} /></label>
        <AdminButton type="submit" variant="secondary">Filter</AdminButton>
      </form>
      {summary && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Verified net votes" value={Number(summary.verified_votes).toLocaleString("en-NZ")} />
          <Stat label="Gross" value={formatCents(Number(summary.gross_cents))} />
          <Stat label="Refunded" value={formatCents(Number(summary.refunded_cents))} />
          <Stat label="Net" value={formatCents(Number(summary.gross_cents) - Number(summary.refunded_cents))} />
          <Stat label="Paid / pending / disputed" value={`${summary.paid_orders} / ${summary.pending_orders} / ${summary.disputed_orders}`} />
        </div>
      )}
      <div className="space-y-6">
        <Card title="Orders">
          <Table>
            <thead><tr><th className={th}>Ref</th><th className={th}>Contestant</th><th className={th}>Package</th><th className={th}>Votes</th><th className={th}>Amount</th><th className={th}>Status</th><th className={th}>Supporter</th><th className={th}>Created</th></tr></thead>
            <tbody>
              {(orders ?? []).map((o) => {
                const item = (o.voting_order_items as unknown as { package_name: string; quantity: number }[])[0];
                return (
                  <tr key={o.id}>
                    <td className={td}><span className="font-mono">{o.public_ref}</span></td>
                    <td className={td}>{(o.contestants as unknown as { public_name: string } | null)?.public_name}</td>
                    <td className={td}>{item?.package_name} × {item?.quantity}</td>
                    <td className={td}>{o.total_votes}</td>
                    <td className={td}>{formatCents(o.total_cents)}</td>
                    <td className={td}><StatusPill tone={o.status === "paid" ? "success" : ["disputed", "review_required", "failed"].includes(o.status) ? "danger" : "neutral"}>{o.status}</StatusPill></td>
                    <td className={td}>{o.supporter_name}{o.display_anonymously && " (anon)"}<span className="block text-xs text-mist">{o.supporter_email}</span></td>
                    <td className={td}>{formatNzDateTime(o.created_at)}</td>
                  </tr>
                );
              })}
              {!orders?.length && <tr><td className={td} colSpan={8}>No orders.</td></tr>}
            </tbody>
          </Table>
        </Card>
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Contestant reconciliation">
            <Table>
              <thead><tr><th className={th}>Contestant</th><th className={th}>Credits</th><th className={th}>Reversals</th><th className={th}>Net</th></tr></thead>
              <tbody>{((tallies ?? []) as { contestant_id: string; public_name: string; credits: number; reversals: number; net: number }[]).map((t) => <tr key={t.contestant_id}><td className={td}>{t.public_name}</td><td className={td}>{t.credits}</td><td className={td}>{t.reversals}</td><td className={td}>{t.net}</td></tr>)}</tbody>
            </Table>
          </Card>
          <Card title="Refunds & disputes">
            <ul className="space-y-2 text-sm">
              {(refunds ?? []).map((r) => <li key={r.stripe_refund_id}>Refund {formatCents(r.amount_cents)} · {(r.voting_orders as unknown as { public_ref: string }).public_ref} · −{r.votes_reversed} votes · {r.status} · {formatNzDateTime(r.created_at)}</li>)}
              {(disputes ?? []).map((d) => <li key={d.stripe_dispute_id} className="text-danger">Dispute {formatCents(d.amount_cents)} · {(d.voting_orders as unknown as { public_ref: string }).public_ref} · {d.status} ({d.reason}) · −{d.votes_reversed} votes</li>)}
              {!refunds?.length && !disputes?.length && <li className="text-mist">None.</li>}
            </ul>
          </Card>
        </div>
        <Card title="Webhook events (latest 30)">
          <Table>
            <thead><tr><th className={th}>Event</th><th className={th}>Type</th><th className={th}>Status</th><th className={th}>Result</th><th className={th}>Attempts</th><th className={th}>Received</th></tr></thead>
            <tbody>{(events ?? []).map((e) => <tr key={e.stripe_event_id}><td className={td}><span className="font-mono text-xs">{e.stripe_event_id}</span></td><td className={td}>{e.event_type}</td><td className={td}>{e.processing_status}</td><td className={td}>{e.result}</td><td className={td}>{e.attempts}</td><td className={td}>{formatNzDateTime(e.received_at)}</td></tr>)}</tbody>
          </Table>
        </Card>
        <p className="text-xs text-mist">To refund a supporter, issue the refund in the Stripe Dashboard. The webhook records it and removes the votes automatically. <Link href="/voting-rules" className="underline">Voting rules</Link></p>
      </div>
    </>
  );
}
