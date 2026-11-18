import { requirePermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import { AdminButton, AdminField, Card, Flash, PageHeader, StatusPill, adminInput } from "@/components/admin/ui";
import { formatCents, isoToNzLocal } from "@/lib/format";
import { activeCampaignSlug } from "@/lib/voting/repo";
import { effectiveVotingState, VOTING_STATE_LABELS } from "@/lib/voting/state";
import { paymentReadiness } from "@/lib/payments/config";
import { saveCampaign, savePackage } from "./actions";

export default async function VotingAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission("voting:configure");
  const sp = await searchParams;
  const db = await createUserClient();
  const { data: campaigns } = await db.from("voting_campaigns").select("*").order("created_at");
  const active = activeCampaignSlug();
  const payments = paymentReadiness();

  return (
    <>
      <PageHeader title="People's Choice voting" description="Voting availability is enforced on the server and in the database. Prices are stored as integer cents." />
      <Flash ok={sp.ok} error={sp.error} />
      <p className="mb-6 rounded border border-line p-3 text-sm">Payments: {payments.ready ? <span className="text-success">enabled ({payments.mode} mode)</span> : <span className="text-gold">disabled — {payments.reason}</span>}</p>
      <div className="space-y-10">
        {(campaigns ?? []).map((c) => (
          <CampaignEditor key={c.id} c={c} isActive={c.slug === active} />
        ))}
      </div>
    </>
  );
}

async function CampaignEditor({ c, isActive }: { c: Record<string, any>; isActive: boolean }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const db = await createUserClient();
  const { data: packages } = await db.from("voting_packages").select("*").eq("campaign_id", c.id).order("sort_order");
  const state = effectiveVotingState({ status: c.status, opens_at: c.opens_at, closes_at: c.closes_at });
  return (
    <section className="space-y-6">
      <h2 className="flex flex-wrap items-center gap-3 font-display text-3xl">
        {c.name} {isActive && <StatusPill tone="success">Shown on website</StatusPill>} {c.is_demo && <StatusPill tone="gold">Demo</StatusPill>}
        <StatusPill>{VOTING_STATE_LABELS[state]}</StatusPill>
      </h2>
      <Card title="Campaign settings">
        <form action={saveCampaign} className="grid gap-4 md:grid-cols-3">
          <input type="hidden" name="id" value={c.id} />
          <AdminField label="Name" className="md:col-span-2"><input name="name" defaultValue={c.name} required className={adminInput} /></AdminField>
          <AdminField label="Status">
            <select name="status" defaultValue={c.status} className={adminInput}>
              {["draft", "scheduled", "open", "paused", "closed", "finalised"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </AdminField>
          <AdminField label="Opens (NZ time)"><input type="datetime-local" name="opensAt" defaultValue={isoToNzLocal(c.opens_at)} className={adminInput} /></AdminField>
          <AdminField label="Closes (NZ time)"><input type="datetime-local" name="closesAt" defaultValue={isoToNzLocal(c.closes_at)} className={adminInput} /></AdminField>
          <AdminField label="Leaderboard refresh (seconds)"><input type="number" name="refreshIntervalSeconds" min={10} max={3600} defaultValue={c.refresh_interval_seconds} className={adminInput} /></AdminField>
          <AdminField label="Max quantity per order"><input type="number" name="maxQuantityPerOrder" min={1} max={100} defaultValue={c.max_quantity_per_order} className={adminInput} /></AdminField>
          <AdminField label="Rules version" hint="Supporters must accept this version"><input name="rulesVersion" defaultValue={c.rules_version} className={adminInput} /></AdminField>
          <AdminField label="Price / GST / fee note" className="md:col-span-3"><input name="priceNote" defaultValue={c.price_note ?? ""} maxLength={500} className={adminInput} /></AdminField>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm md:col-span-3">
            {[["showLeaderboard", "Public leaderboard", c.show_leaderboard], ["showRankings", "Show rankings", c.show_rankings], ["showVoteCounts", "Show vote counts", c.show_vote_counts],
              ["showSupporterHistory", "Show supporter history", c.show_supporter_history], ["freezeLeaderboard", `Freeze leaderboard${c.leaderboard_frozen_at ? " (frozen)" : ""}`, !!c.leaderboard_frozen_at], ["resultsPublished", "Final results published", c.results_published]].map(([n, l, d]) => (
              <label key={n as string} className="flex items-center gap-2"><input type="checkbox" name={n as string} defaultChecked={d as boolean} /> {l as string}</label>
            ))}
          </div>
          <div className="md:col-span-3"><AdminButton type="submit">Save campaign</AdminButton></div>
        </form>
      </Card>
      <Card title="Packages">
        <div className="space-y-3">
          {(packages ?? []).map((p) => <PackageRow key={p.id} campaignId={c.id} p={p} />)}
          <details className="rounded border border-dashed border-line p-3"><summary className="cursor-pointer text-sm text-gold">Add package</summary><div className="mt-3"><PackageRow campaignId={c.id} /></div></details>
        </div>
      </Card>
    </section>
  );
}

function PackageRow({ campaignId, p }: { campaignId: string; p?: Record<string, any> }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    <form action={savePackage} className="grid items-end gap-3 rounded border border-line p-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.6fr_0.6fr_auto]">
      {p && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="campaignId" value={campaignId} />
      <AdminField label="Name"><input name="name" defaultValue={p?.name} required className={adminInput} /></AdminField>
      <AdminField label="Label"><input name="displayLabel" defaultValue={p?.display_label ?? ""} className={adminInput} /></AdminField>
      <AdminField label="Price (NZD)" hint={p ? formatCents(p.price_cents) : undefined}><input name="price" defaultValue={p ? `${Math.floor(p.price_cents / 100)}.${String(p.price_cents % 100).padStart(2, "0")}` : ""} inputMode="decimal" required className={adminInput} /></AdminField>
      <AdminField label="Votes"><input name="votes" type="number" min={1} defaultValue={p?.votes} required className={adminInput} /></AdminField>
      <AdminField label="Order"><input name="sortOrder" type="number" min={0} defaultValue={p?.sort_order ?? 0} className={adminInput} /></AdminField>
      <AdminField label="Max qty"><input name="maxQuantity" type="number" min={1} max={100} defaultValue={p?.max_quantity ?? 10} className={adminInput} /></AdminField>
      <div className="space-y-1 text-xs">
        <label className="flex items-center gap-1"><input type="checkbox" name="isActive" defaultChecked={p?.is_active ?? true} /> Active</label>
        <label className="flex items-center gap-1"><input type="checkbox" name="isDemoValue" defaultChecked={p?.is_demo_value ?? false} /> Demo value</label>
        <AdminButton type="submit" variant="secondary">{p ? "Save" : "Add"}</AdminButton>
      </div>
    </form>
  );
}
