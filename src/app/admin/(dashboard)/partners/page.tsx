import { requirePermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import { AdminButton, AdminField, Card, Flash, PageHeader, StatusPill, adminInput } from "@/components/admin/ui";
import { ImageUpload } from "@/components/admin/image-upload";
import { publicMediaUrl } from "@/lib/content/repo";
import { deletePartner, savePartner } from "./actions";

const CATS = [["presenting", "Presenting Partner"], ["major", "Major Partner"], ["supporting", "Supporting Partner"], ["media", "Media Partner"], ["community", "Community Partner"]] as const;

type P = { id: string; name: string; category: string; description: string | null; url: string | null; sort_order: number; confirmed: boolean; is_published: boolean; logo_path: string | null };

function PartnerForm({ p }: { p?: P }) {
  return (
    <form action={savePartner} className="grid gap-3 sm:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <AdminField label="Name"><input name="name" defaultValue={p?.name} required className={adminInput} /></AdminField>
      <AdminField label="Category"><select name="category" defaultValue={p?.category ?? "supporting"} className={adminInput}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></AdminField>
      <AdminField label="Website" className="sm:col-span-2"><input name="url" type="url" defaultValue={p?.url ?? ""} placeholder="https://" className={adminInput} /></AdminField>
      <AdminField label="Description" className="sm:col-span-2"><textarea name="description" defaultValue={p?.description ?? ""} rows={2} className={adminInput} /></AdminField>
      <AdminField label="Order"><input name="sortOrder" type="number" min={0} defaultValue={p?.sort_order ?? 0} className={adminInput} /></AdminField>
      <div className="space-y-1 pt-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="confirmed" defaultChecked={p?.confirmed} /> Partnership confirmed in writing</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isPublished" defaultChecked={p?.is_published} /> Published</label>
      </div>
      <div className="sm:col-span-2"><ImageUpload name="logoPath" folder="partners" label="Approved logo" initialPath={p?.logo_path} initialUrl={publicMediaUrl(p?.logo_path)} /></div>
      <div className="sm:col-span-2"><AdminButton type="submit">{p ? "Save" : "Add partner"}</AdminButton></div>
    </form>
  );
}

export default async function PartnersAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission("content:write");
  const sp = await searchParams;
  const db = await createUserClient();
  const { data } = await db.from("partners").select("*").order("category").order("sort_order");
  return (
    <>
      <PageHeader title="Partners" description="Only confirmed partners can be published. Never list a sponsor before the relationship is confirmed." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="space-y-6">
        {((data ?? []) as P[]).map((p) => (
          <Card key={p.id} title={p.name} actions={<div className="flex gap-2"><StatusPill tone={p.is_published ? "success" : "neutral"}>{p.is_published ? "Published" : "Hidden"}</StatusPill><form action={deletePartner}><input type="hidden" name="id" value={p.id} /><button className="text-xs text-danger underline">Delete</button></form></div>}>
            <PartnerForm p={p} />
          </Card>
        ))}
        <Card title="Add partner"><PartnerForm /></Card>
      </div>
    </>
  );
}
