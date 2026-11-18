import { requirePermission } from "@/lib/auth/session";
import { AdminButton, AdminField, Card, Flash, PageHeader, StatusPill, adminInput } from "@/components/admin/ui";
import { getSettings } from "@/lib/content/repo";
import { isoToNzLocal } from "@/lib/format";
import { appEnv, serverEnv } from "@/lib/env";
import { paymentReadiness } from "@/lib/payments/config";
import { getRegistrationState } from "@/lib/registration";
import { missingLaunchApprovals } from "@/lib/registration-state";
import { siteUrl } from "@/lib/site";
import { saveSettings } from "./actions";

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={checked} /> {label}</label>;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission("settings:write");
  const [sp, s, reg] = await Promise.all([searchParams, getSettings(), getRegistrationState()]);
  const env = serverEnv();
  const pay = paymentReadiness();
  const missing = missingLaunchApprovals(s);
  const e = s.event;

  const integrations: [string, boolean, string][] = [
    ["Site URL", true, siteUrl()],
    ["Environment", true, appEnv()],
    ["Supabase", !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY, process.env.NEXT_PUBLIC_SUPABASE_URL ? "Connected" : "Not configured"],
    ["Email (Resend)", !!env.RESEND_API_KEY && !!env.EMAIL_FROM, env.EMAIL_FROM ? `From ${env.EMAIL_FROM}` : "Not configured — emails are logged but not sent"],
    ["Admin notifications", !!env.ADMIN_NOTIFICATION_EMAIL, env.ADMIN_NOTIFICATION_EMAIL ? "Configured" : "Not configured"],
    ["Stripe payments", pay.ready, pay.ready ? `Enabled (${pay.mode})` : pay.reason],
    ["Registration flag", env.REGISTRATION_ENABLED, env.REGISTRATION_ENABLED ? "REGISTRATION_ENABLED=true" : "Disabled by environment"],
  ];

  return (
    <>
      <PageHeader title="Settings" description="Changes publish immediately. Secrets are configured in Vercel environment variables, never here." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Launch readiness">
          <p className="mb-3 text-sm">Registration state: <StatusPill tone={reg.state === "open" ? "success" : "gold"}>{reg.state.replace(/_/g, " ")}</StatusPill></p>
          {missing.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-gold">{missing.map((m) => <li key={m}>Approval needed: {m}</li>)}</ul>
          ) : <p className="text-sm text-success">All registration approvals recorded.</p>}
          <h3 className="mt-5 text-xs uppercase tracking-[0.1em] text-mist">Integrations</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {integrations.map(([k, ok, v]) => <li key={k} className="flex justify-between gap-4"><span>{k}</span><span className={ok ? "text-success" : "text-gold"}>{v}</span></li>)}
          </ul>
        </Card>

        <Card title="Event details">
          <form action={saveSettings} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="event" />
            <AdminField label="Event name"><input name="name" defaultValue={e.name} className={adminInput} /></AdminField>
            <AdminField label="Organiser"><input name="organiser" defaultValue={e.organiser} className={adminInput} /></AdminField>
            <AdminField label="Tagline" className="sm:col-span-2"><input name="tagline" defaultValue={e.tagline} className={adminInput} /></AdminField>
            <AdminField label="Short description" className="sm:col-span-2"><textarea name="shortDescription" defaultValue={e.shortDescription} rows={2} className={adminInput} /></AdminField>
            <AdminField label="Finale date"><input type="date" name="finaleDate" defaultValue={e.finaleDate} className={adminInput} /></AdminField>
            <AdminField label="Finale display text"><input name="finaleDisplay" defaultValue={e.finaleDisplay} className={adminInput} /></AdminField>
            <AdminField label="Venue name"><input name="venueName" defaultValue={e.venueName} className={adminInput} /></AdminField>
            <AdminField label="Venue short"><input name="venueShort" defaultValue={e.venueShort} className={adminInput} /></AdminField>
            <AdminField label="Venue address" className="sm:col-span-2"><input name="venueAddress" defaultValue={e.venueAddress} className={adminInput} /></AdminField>
            <AdminField label="Rehearsal start"><input type="date" name="rehearsalStart" defaultValue={e.rehearsalStart} className={adminInput} /></AdminField>
            <AdminField label="Rehearsal end"><input type="date" name="rehearsalEnd" defaultValue={e.rehearsalEnd} className={adminInput} /></AdminField>
            <AdminField label="Rehearsal display text" className="sm:col-span-2"><input name="rehearsalDisplay" defaultValue={e.rehearsalDisplay} className={adminInput} /></AdminField>
            <div className="space-y-1 sm:col-span-2">
              <Check name="taglineApproved" label="Tagline approved by organiser" checked={e.taglineApproved} />
              <Check name="contestantFeeTermsApproved" label="NZ$350 fee GST/due date/refund terms approved" checked={e.contestantFeeTermsApproved} />
              <Check name="countdownEnabled" label="Show countdown on homepage" checked={e.countdownEnabled} />
            </div>
            <div className="sm:col-span-2"><AdminButton type="submit">Save event details</AdminButton></div>
          </form>
        </Card>

        <Card title="Registration window & eligibility">
          <form action={saveSettings} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="registration" />
            <AdminField label="Opens (NZ time)"><input type="datetime-local" name="opensAt" defaultValue={isoToNzLocal(s.registration.opensAt)} className={adminInput} /></AdminField>
            <AdminField label="Closes (NZ time)"><input type="datetime-local" name="closesAt" defaultValue={isoToNzLocal(s.registration.closesAt)} className={adminInput} /></AdminField>
            <AdminField label="Minimum age"><input type="number" name="minimumAge" min={16} max={30} defaultValue={s.registration.minimumAge} className={adminInput} /></AdminField>
            <AdminField label="Age measured on"><input type="date" name="ageReferenceDate" defaultValue={s.registration.ageReferenceDate} className={adminInput} /></AdminField>
            <div className="space-y-1 sm:col-span-2">
              <Check name="datesApproved" label="Registration dates confirmed" checked={s.registration.datesApproved} />
              <Check name="agePolicyApproved" label="Age policy approved (enforces minimum age)" checked={s.registration.agePolicyApproved} />
              <Check name="eligibilityApproved" label="Eligibility definitions approved (organiser + legal)" checked={s.registration.eligibilityApproved} />
            </div>
            <div className="sm:col-span-2"><AdminButton type="submit">Save registration</AdminButton></div>
          </form>
        </Card>

        <Card title="Legal documents">
          <form action={saveSettings} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="legal" />
            {([["privacy", "Privacy statement"], ["websiteTerms", "Website terms"], ["contestantTerms", "Contestant terms"], ["votingRules", "Voting rules"]] as const).map(([k, l]) => (
              <div key={k} className="space-y-1">
                <AdminField label={`${l} version`}><input name={`${k}Version`} defaultValue={s.legal.versions[k]} className={adminInput} /></AdminField>
                <Check name={`${k}Approved`} label="Approved" checked={s.legal.approved[k]} />
              </div>
            ))}
            <p className="text-xs text-mist sm:col-span-2">Changing a version number is recorded against new applications and orders. The legal text itself is maintained in code (src/lib/content/legal.ts) so changes are reviewed.</p>
            <div className="sm:col-span-2"><AdminButton type="submit">Save legal settings</AdminButton></div>
          </form>
        </Card>

        <Card title="Contact & social">
          <form action={saveSettings} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="section" value="contact" />
            <AdminField label="Public email"><input name="email" type="email" defaultValue={s.contact.email ?? ""} className={adminInput} /></AdminField>
            <AdminField label="Phone"><input name="phone" defaultValue={s.contact.phone ?? ""} className={adminInput} /></AdminField>
            {(["instagram", "facebook", "tiktok", "youtube"] as const).map((k) => (
              <AdminField key={k} label={k}><input name={k} type="url" defaultValue={s.contact.socials[k] ?? ""} placeholder="https://" className={adminInput} /></AdminField>
            ))}
            <div className="sm:col-span-2"><AdminButton type="submit">Save contact details</AdminButton></div>
          </form>
        </Card>

        <Card title="Tickets">
          <form action={saveSettings} className="space-y-3">
            <input type="hidden" name="section" value="tickets" />
            <AdminField label="Approved ticketing URL" hint="Leave blank to show “Tickets Coming Soon”."><input name="url" type="url" defaultValue={s.tickets.url ?? ""} placeholder="https://" className={adminInput} /></AdminField>
            <AdminField label="Note shown while tickets are not on sale"><input name="note" defaultValue={s.tickets.note} className={adminInput} /></AdminField>
            <AdminButton type="submit">Save tickets</AdminButton>
          </form>
        </Card>

        <Card title="Announcement bar">
          <form action={saveSettings} className="space-y-3">
            <input type="hidden" name="section" value="announcement" />
            <Check name="enabled" label="Show announcement" checked={s.announcement.enabled} />
            <AdminField label="Text"><input name="text" defaultValue={s.announcement.text} maxLength={200} className={adminInput} /></AdminField>
            <AdminField label="Link (optional)" hint="/apply or https://…"><input name="href" defaultValue={s.announcement.href ?? ""} className={adminInput} /></AdminField>
            <AdminButton type="submit">Save announcement</AdminButton>
          </form>
        </Card>

        <Card title="Photography">
          <form action={saveSettings} className="space-y-3">
            <input type="hidden" name="section" value="media" />
            <p className="text-xs text-mist">Upload approved images in Media, copy their URL here. Leave the hero blank to use the designed stage backdrop. Never use AI-generated portraits or unlicensed stock.</p>
            <AdminField label="Homepage hero image URL"><input name="heroImage" type="url" defaultValue={s.media.heroImage ?? ""} placeholder="https://" className={adminInput} /></AdminField>
            <AdminField label="Homepage hero video URL (MP4, muted loop)"><input name="heroVideo" type="url" defaultValue={s.media.heroVideo ?? ""} placeholder="https://" className={adminInput} /></AdminField>
            <AdminField label="Final call-to-action background image URL"><input name="ctaImage" type="url" defaultValue={s.media.ctaImage ?? ""} placeholder="https://" className={adminInput} /></AdminField>
            <AdminField label="Legacy gallery" hint="One per line: image URL | caption | alt text (first image is shown large)">
              <textarea name="legacy" rows={6} className={`${adminInput} font-mono text-xs`} defaultValue={s.media.legacy.map((m) => `${m.src} | ${m.caption} | ${m.alt}`).join("\n")} />
            </AdminField>
            <AdminButton type="submit">Save photography</AdminButton>
          </form>
        </Card>

        <Card title="Key dates (milestones)">
          <form action={saveSettings} className="space-y-3">
            <input type="hidden" name="section" value="milestones" />
            <AdminField label="One per line" hint="YYYY-MM-DD | Label | confirmed or proposed">
              <textarea name="milestones" rows={7} className={`${adminInput} font-mono`} defaultValue={s.milestones.map((m) => `${m.date} | ${m.label} | ${m.confirmed ? "confirmed" : "proposed"}`).join("\n")} />
            </AdminField>
            <AdminButton type="submit">Save milestones</AdminButton>
          </form>
        </Card>
      </div>
    </>
  );
}
