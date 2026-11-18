/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { AdminButton, Card, Flash, PageHeader, StatusPill, adminInput } from "@/components/admin/ui";
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/validation/admin";
import { ageOn } from "@/lib/validation/registration";
import { formatNzDate, formatNzDateTime } from "@/lib/format";
import { getSettings } from "@/lib/content/repo";
import { addNote, anonymiseApplication, changeStatus, createContestantFromApplication, sendApplicantEmail } from "../actions";

const KIND_LABEL: Record<string, string> = { headshot: "Headshot", full_length: "Full-length", traditional: "Traditional outfit" };

export default async function ApplicationDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requirePermission("applications:read");
  const [{ id }, sp, settings] = await Promise.all([params, searchParams, getSettings()]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createUserClient();
  const { data: a } = await db.from("applications").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();

  const [{ data: media }, { data: history }, { data: notes }, { data: contestant }] = await Promise.all([
    db.from("application_media").select("kind, storage_path, mime_type, size_bytes").eq("application_id", id),
    db.from("application_status_history").select("from_status, to_status, changed_by, note, changed_at").eq("application_id", id).order("changed_at"),
    db.from("application_notes").select("body, author_id, created_at").eq("application_id", id).order("created_at"),
    db.from("contestants").select("id, slug, publication_status").eq("application_id", id).maybeSingle(),
  ]);

  // Private photos: short-lived signed URLs, generated only after the role check above (RLS returned the rows).
  const service = createServiceClient();
  const signed: Record<string, string> = {};
  if (service && media?.length) {
    const { data: urls } = await service.storage.from("mrindianz-applications").createSignedUrls(media.map((m) => m.storage_path), 600);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed[u.path] = u.signedUrl;
  }

  const canUpdate = can(session.roles, "applications:update");
  const age = ageOn(a.date_of_birth, settings.registration.ageReferenceDate);
  const anonymised = !!a.anonymised_at;
  const path = `/admin/applications/${id}`;

  return (
    <>
      <PageHeader
        title={anonymised ? "Deleted applicant" : a.legal_name}
        description={<>Reference <span className="font-mono text-gold">{a.reference}</span> · submitted {formatNzDateTime(a.submitted_at)}</>}
        actions={<Link href="/admin/applications" className="text-sm text-gold underline">← All applications</Link>}
      />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card title="Applicant details">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["Legal name", a.legal_name], ["Stage name", a.stage_name], ["Date of birth", `${formatNzDate(a.date_of_birth)} (${age} on ${settings.registration.ageReferenceDate})`],
                ["Email", a.email], ["Mobile", a.mobile], ["Location", `${a.city}, ${a.region}`], ["Occupation / study", a.occupation], ["Instagram", a.instagram],
                ["Video", a.video_url], ["Marketing opt-in", a.marketing_opt_in ? `Yes (${formatNzDateTime(a.marketing_consent_at)})` : "No"],
              ].map(([k, v]) => (
                <div key={k as string}><dt className="text-xs uppercase tracking-[0.1em] text-mist">{k}</dt><dd className="mt-0.5 break-words">{k === "Video" && v ? <a href={v as string} target="_blank" rel="noopener noreferrer nofollow" className="text-gold underline">{v}</a> : (v as string) || "—"}</dd></div>
              ))}
            </dl>
            {!settings.registration.agePolicyApproved && <p className="mt-4 text-xs text-gold">Age policy not yet approved — age was not enforced at submission.</p>}
          </Card>

          <Card title="Personal story">
            <div className="space-y-5 text-sm">
              {[["Why do you want to enter?", a.why_enter], ["What does being Kiwi-Indian mean to you?", a.kiwi_indian_meaning], ["Interests, achievements, community work", a.interests],
                ["Previous experience", a.has_experience ? a.experience_details || "Yes" : "No"], ["Mr. Talent audition", a.talent_audition ? `Yes — ${a.talent_description ?? ""}` : "No"]].map(([q, v]) => (
                <div key={q as string}><p className="text-xs uppercase tracking-[0.1em] text-mist">{q}</p><p className="mt-1 whitespace-pre-wrap">{(v as string) || "—"}</p></div>
              ))}
            </div>
          </Card>

          <Card title="Photographs (private)">
            {media?.length ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {media.map((m) => (
                  <figure key={m.kind}>
                    {signed[m.storage_path] ? (
                      <a href={signed[m.storage_path]} target="_blank" rel="noopener noreferrer"><img src={signed[m.storage_path]} alt={`${KIND_LABEL[m.kind]} submitted by applicant`} className="aspect-[4/5] w-full rounded object-cover" /></a>
                    ) : <div className="flex aspect-[4/5] items-center justify-center rounded bg-charcoal-2 text-xs text-mist">Preview unavailable</div>}
                    <figcaption className="mt-1 text-xs text-mist">{KIND_LABEL[m.kind]} · {(m.size_bytes / 1024 / 1024).toFixed(1)} MB</figcaption>
                  </figure>
                ))}
              </div>
            ) : <p className="text-sm text-mist">{anonymised ? "Deleted." : "No photographs on file."}</p>}
            <p className="mt-3 text-xs text-mist">Links expire after 10 minutes. Do not download or forward applicant photographs.</p>
          </Card>

          <Card title="Notes">
            <ul className="mb-4 space-y-3 text-sm">
              {(notes ?? []).map((n, i) => <li key={i} className="rounded border border-line p-3"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-xs text-mist">{formatNzDateTime(n.created_at)}</p></li>)}
              {!notes?.length && <li className="text-mist">No notes yet.</li>}
            </ul>
            {canUpdate && !anonymised && (
              <form action={addNote} className="space-y-2">
                <input type="hidden" name="applicationId" value={id} />
                <textarea name="body" rows={3} required maxLength={4000} className={adminInput} aria-label="New note" placeholder="Add an internal note" />
                <AdminButton type="submit" variant="secondary">Add note</AdminButton>
              </form>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status">
            <p className="mb-4"><StatusPill tone="gold">{STATUS_LABELS[a.status as ApplicationStatus]}</StatusPill></p>
            {canUpdate && !anonymised && (
              <form action={changeStatus} className="space-y-3">
                <input type="hidden" name="applicationIds" value={id} />
                <input type="hidden" name="returnTo" value={path} />
                <select name="status" defaultValue={a.status} className={adminInput} aria-label="New status">
                  {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
                <input name="note" maxLength={500} className={adminInput} placeholder="Note (optional)" aria-label="Status note" />
                <AdminButton type="submit">Update status</AdminButton>
              </form>
            )}
            <h3 className="mt-6 text-xs uppercase tracking-[0.1em] text-mist">History</h3>
            <ol className="mt-2 space-y-2 text-sm">
              {(history ?? []).map((h, i) => (
                <li key={i} className="border-l border-line pl-3">
                  {h.from_status ? `${STATUS_LABELS[h.from_status as ApplicationStatus]} → ` : ""}{STATUS_LABELS[h.to_status as ApplicationStatus]}
                  <span className="block text-xs text-mist">{formatNzDateTime(h.changed_at)}{h.changed_by ? ` · by ${String(h.changed_by).slice(0, 8)}` : " · system"}{h.note ? ` · ${h.note}` : ""}</span>
                </li>
              ))}
            </ol>
          </Card>

          {canUpdate && !anonymised && (
            <Card title="Send email">
              <form action={sendApplicantEmail} className="space-y-3">
                <input type="hidden" name="applicationId" value={id} />
                <input type="hidden" name="nonce" value={new Date().toISOString().slice(0, 13)} />
                <select name="templateKey" className={adminInput} aria-label="Template">
                  <option value="application_shortlisted">Shortlisted</option>
                  <option value="audition_invitation">Audition invitation</option>
                  <option value="selection_offer">Selection offer</option>
                  <option value="acceptance_confirmation">Acceptance confirmation</option>
                  <option value="contestant_confirmation">Contestant confirmation</option>
                  <option value="application_unsuccessful">Unsuccessful (rejection)</option>
                </select>
                <textarea name="details" rows={3} className={adminInput} placeholder="Audition/offer details (inserted into the template)" aria-label="Details" />
                <AdminButton type="submit" variant="secondary">Send</AdminButton>
                <p className="text-xs text-mist">Photos are never attached. The same template is sent at most once per hour per applicant.</p>
              </form>
            </Card>
          )}

          <Card title="Contestant profile">
            {contestant ? (
              <p className="text-sm">Profile exists ({contestant.publication_status}). <Link href={`/admin/contestants/${contestant.id}`} className="text-gold underline">Edit profile</Link></p>
            ) : can(session.roles, "contestants:write") && !anonymised ? (
              <form action={createContestantFromApplication}>
                <input type="hidden" name="applicationId" value={id} />
                <p className="mb-3 text-xs text-mist">Creates a DRAFT profile with only the public name and location. Nothing is published automatically.</p>
                <AdminButton type="submit" variant="secondary">Create draft contestant profile</AdminButton>
              </form>
            ) : <p className="text-sm text-mist">No profile.</p>}
          </Card>

          <Card title="Consents & policy versions">
            <pre className="whitespace-pre-wrap break-words text-xs text-mist">{JSON.stringify({ consents: a.consents, policy_versions: a.policy_versions }, null, 2)}</pre>
          </Card>

          {can(session.roles, "applications:delete") && !anonymised && (
            <Card title="Delete applicant data">
              <form action={anonymiseApplication} className="space-y-3">
                <input type="hidden" name="applicationId" value={id} />
                <p className="text-xs text-mist">Permanently deletes photographs and personal details (privacy request or retention policy). Status history is kept without personal data.</p>
                <input name="confirm" placeholder="Type DELETE" className={adminInput} aria-label="Type DELETE to confirm" />
                <AdminButton type="submit" variant="danger">Delete personal data</AdminButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
