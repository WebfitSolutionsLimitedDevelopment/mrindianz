/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createUserClient } from "@/lib/supabase/server";
import { AdminButton, AdminField, Card, Flash, PageHeader, adminInput } from "@/components/admin/ui";
import { ImageUpload } from "@/components/admin/image-upload";
import { publicMediaUrl } from "@/lib/content/repo";
import { appEnv } from "@/lib/env";
import { contestantPath, qrBaseUrl } from "@/lib/site";
import { addGalleryImage, removeGalleryImage, saveContestant } from "../actions";

export default async function EditContestant({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requirePermission("contestants:read");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const isNew = id === "new";
  const db = await createUserClient();
  type Row = { id: string; slug: string; contestant_number: number | null; public_name: string; short_bio: string | null; biography: string | null; city_region: string | null; interests: string[]; talent_info: string | null; social_links: Record<string, string>; profile_image_path: string | null; publication_status: string; voting_eligible: boolean; application_id: string | null };
  let c: Row | null = null;
  if (!isNew) {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const { data } = await db.from("contestants").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    c = data as Row;
  }
  const { data: gallery } = c ? await db.from("contestant_media").select("id, storage_path, alt_text, sort_order").eq("contestant_id", c.id).order("sort_order") : { data: [] };
  const editable = can(session.roles, "contestants:write");
  const publicUrl = c ? `${qrBaseUrl(appEnv() === "production")}${contestantPath(c.slug)}` : null;

  return (
    <>
      <PageHeader title={isNew ? "New contestant" : c!.public_name} description={publicUrl ? <>Permanent URL: <span className="font-mono text-gold">{publicUrl}</span></> : "The URL slug is set once and can never be changed."}
        actions={<Link href="/admin/contestants" className="text-sm text-gold underline">← All contestants</Link>} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Profile">
          <form action={saveContestant} className="space-y-5">
            <fieldset disabled={!editable} className="space-y-5">
              {c && <input type="hidden" name="id" value={c.id} />}
              <div className="grid gap-4 sm:grid-cols-3">
                <AdminField label="Public name" className="sm:col-span-2"><input name="publicName" required defaultValue={c?.public_name} maxLength={80} className={adminInput} /></AdminField>
                <AdminField label="Contestant number"><input name="contestantNumber" type="number" min={1} max={999} defaultValue={c?.contestant_number ?? ""} className={adminInput} /></AdminField>
              </div>
              {isNew && <AdminField label="URL slug (optional)" hint="Defaults to contestant-NN. Permanent once created."><input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} className={adminInput} /></AdminField>}
              <AdminField label="City / region"><input name="cityRegion" defaultValue={c?.city_region ?? ""} maxLength={80} className={adminInput} /></AdminField>
              <AdminField label="Short biography (cards)" hint="Up to 280 characters."><textarea name="shortBio" defaultValue={c?.short_bio ?? ""} maxLength={280} rows={2} className={adminInput} /></AdminField>
              <AdminField label="Biography" hint="Approved by the contestant. Blank line = new paragraph."><textarea name="biography" defaultValue={c?.biography ?? ""} maxLength={5000} rows={8} className={adminInput} /></AdminField>
              <AdminField label="Interests" hint="Comma separated"><input name="interests" defaultValue={c?.interests.join(", ")} className={adminInput} /></AdminField>
              <AdminField label="Talent information (if approved)"><textarea name="talentInfo" defaultValue={c?.talent_info ?? ""} maxLength={1000} rows={2} className={adminInput} /></AdminField>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["instagram", "facebook", "tiktok", "youtube"] as const).map((k) => (
                  <AdminField key={k} label={`${k} URL`}><input name={k} type="url" defaultValue={c?.social_links?.[k] ?? ""} placeholder="https://" className={adminInput} /></AdminField>
                ))}
              </div>
              <ImageUpload name="profileImagePath" folder="contestants" label="Profile photograph" initialPath={c?.profile_image_path} initialUrl={publicMediaUrl(c?.profile_image_path)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField label="Publication status">
                  <select name="publicationStatus" defaultValue={c?.publication_status ?? "draft"} className={adminInput}>
                    <option value="draft">Draft (hidden)</option><option value="published">Published</option><option value="archived">Archived (hidden)</option>
                  </select>
                </AdminField>
                <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" name="votingEligible" defaultChecked={c?.voting_eligible} /> Eligible for People&apos;s Choice voting</label>
              </div>
              {editable && <AdminButton type="submit">{isNew ? "Create contestant" : "Save changes"}</AdminButton>}
            </fieldset>
          </form>
        </Card>

        {c && (
          <div className="space-y-6">
            <Card title="QR code">
              {c.publication_status === "published" ? (
                <>
                  <img src={`/api/qr/${c.slug}?format=svg`} alt={`QR code for ${publicUrl}`} className="w-48 rounded bg-white p-2" />
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <a className="text-gold underline" href={`/api/qr/${c.slug}?format=png&download=1`}>PNG</a>
                    <a className="text-gold underline" href={`/api/qr/${c.slug}?format=svg&download=1`}>SVG</a>
                    <Link className="text-gold underline" href={`/contestants/${c.slug}/qr`} target="_blank">Print</Link>
                    <Link className="text-gold underline" href={`/contestants/${c.slug}`} target="_blank">View profile</Link>
                  </div>
                </>
              ) : <p className="text-sm text-mist">QR codes are available once the profile is published.</p>}
            </Card>
            <Card title="Gallery">
              <ul className="mb-4 grid grid-cols-3 gap-2">
                {(gallery ?? []).map((g) => (
                  <li key={g.id} className="space-y-1">
                    <img src={publicMediaUrl(g.storage_path) ?? ""} alt={g.alt_text} className="aspect-square w-full rounded object-cover" />
                    {editable && (
                      <form action={removeGalleryImage}><input type="hidden" name="mediaId" value={g.id} /><input type="hidden" name="contestantId" value={c.id} /><button className="text-xs text-danger underline">Remove</button></form>
                    )}
                  </li>
                ))}
              </ul>
              {editable && (
                <form action={addGalleryImage} className="space-y-3 border-t border-line pt-4">
                  <input type="hidden" name="contestantId" value={c.id} />
                  <ImageUpload name="galleryPath" folder="contestants" label="Add gallery image" />
                  <AdminField label="Alt text"><input name="alt" required minLength={3} maxLength={200} className={adminInput} /></AdminField>
                  <AdminButton type="submit" variant="secondary">Add to gallery</AdminButton>
                </form>
              )}
            </Card>
            {c.application_id && can(session.roles, "applications:read") && (
              <Card title="Source application"><Link href={`/admin/applications/${c.application_id}`} className="text-sm text-gold underline">Open application (private)</Link></Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
