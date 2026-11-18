/* eslint-disable @next/next/no-img-element */
import { revalidatePath } from "next/cache";
import { requirePermission, assertPermission } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { AdminButton, Card, Flash, PageHeader } from "@/components/admin/ui";
import { ImageUpload } from "@/components/admin/image-upload";
import { publicMediaUrl } from "@/lib/content/repo";
import { back } from "@/lib/admin/flash";
import { audit } from "@/lib/audit";

async function removeMedia(formData: FormData) {
  "use server";
  const session = await assertPermission("content:write");
  const path = String(formData.get("path"));
  if (!/^(contestants|partners|site)\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path)) back("/admin/media", { error: "Invalid path." });
  const db = createServiceClient();
  if (db) await db.storage.from("mrindianz-public").remove([path]);
  await audit(session.userId, "media_deleted", "storage", path);
  revalidatePath("/admin/media");
  back("/admin/media", { ok: "Image deleted. Remove it from any profile or partner that used it." });
}

export default async function MediaAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission("content:write");
  const sp = await searchParams;
  const db = createServiceClient();
  const folders = ["contestants", "partners", "site"] as const;
  const lists = db ? await Promise.all(folders.map((f) => db.storage.from("mrindianz-public").list(f, { limit: 200, sortBy: { column: "created_at", order: "desc" } }))) : [];
  return (
    <>
      <PageHeader title="Media library" description="Approved public images only. Applicant photographs are stored separately and privately and never appear here." />
      <Flash ok={sp.ok} error={sp.error} />
      <Card title="Upload site image" className="mb-6">
        <form><ImageUpload name="ignored" folder="site" label="Upload (copy the URL below once listed)" /></form>
      </Card>
      {folders.map((f, i) => (
        <Card key={f} title={f} className="mb-6">
          <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {(lists[i]?.data ?? []).filter((o) => o.name && !o.name.startsWith(".")).map((o) => {
              const path = `${f}/${o.name}`;
              const url = publicMediaUrl(path);
              return (
                <li key={path} className="space-y-1 text-xs">
                  {url && <img src={url} alt="" className="aspect-square w-full rounded object-cover" loading="lazy" />}
                  <input readOnly value={url ?? ""} className="w-full rounded border border-line bg-ink px-2 py-1 font-mono text-[10px]" aria-label="Public URL" />
                  <form action={removeMedia}><input type="hidden" name="path" value={path} /><AdminButton type="submit" variant="secondary" className="min-h-7 px-2 text-[10px]">Delete</AdminButton></form>
                </li>
              );
            })}
            {!lists[i]?.data?.length && <li className="text-mist">Empty.</li>}
          </ul>
        </Card>
      ))}
    </>
  );
}
