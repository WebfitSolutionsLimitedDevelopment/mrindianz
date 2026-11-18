import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import { AdminButton, AdminField, Card, Flash, PageHeader, StatusPill, adminInput } from "@/components/admin/ui";
import { formatNzDateTime } from "@/lib/format";
import type { SectionContent } from "@/lib/content/defaults";
import { discardDraft, saveSection } from "./actions";

const PAGES = [["home", "Homepage"], ["about", "About"], ["competition", "Competition"]] as const;

export default async function ContentAdmin({ searchParams }: { searchParams: Promise<{ page?: string; ok?: string; error?: string }> }) {
  await requirePermission("content:write");
  const sp = await searchParams;
  const page = PAGES.some(([p]) => p === sp.page) ? sp.page! : "home";
  const db = await createUserClient();
  const { data: sections } = await db.from("content_sections").select("key, draft, published, approval_status, published_at, sort_order").eq("page_slug", page).order("sort_order");

  return (
    <>
      <PageHeader title="Website content" description="Save a draft to prepare changes privately, then Publish to make them live. Event dates, tagline, venue and ticket links are in Settings." />
      <Flash ok={sp.ok} error={sp.error} />
      <nav className="mb-6 flex gap-2" aria-label="Pages">
        {PAGES.map(([p, l]) => <Link key={p} href={`/admin/content?page=${p}`} aria-current={p === page ? "page" : undefined} className={`rounded border px-3 py-1.5 text-sm ${p === page ? "border-gold text-gold" : "border-line"}`}>{l}</Link>)}
      </nav>
      <div className="space-y-6">
        {(sections ?? []).map((s) => {
          const c = (s.draft ?? s.published ?? { title: "", body: "" }) as SectionContent;
          return (
            <Card key={s.key} title={s.key.replace(/_/g, " ")} actions={<div className="flex gap-2">{s.draft && <StatusPill tone="gold">Unpublished draft</StatusPill>}<StatusPill tone={s.approval_status === "approved" ? "success" : "neutral"}>{s.approval_status === "approved" ? "Approved" : "Pending approval"}</StatusPill></div>}>
              <form action={saveSection} className="space-y-4">
                <input type="hidden" name="page" value={page} />
                <input type="hidden" name="key" value={s.key} />
                <AdminField label="Title"><input name="title" defaultValue={c.title} required maxLength={200} className={adminInput} /></AdminField>
                <AdminField label="Body" hint="Plain text. Leave a blank line between paragraphs."><textarea name="body" defaultValue={c.body} rows={5} className={adminInput} /></AdminField>
                {(c.items || ["pillars", "journey", "rounds", "eligibility"].includes(s.key)) && (
                  <AdminField label="Items" hint="One per line: Title | Description"><textarea name="items" defaultValue={(c.items ?? []).map((i) => `${i.title} | ${i.body}`).join("\n")} rows={6} className={`${adminInput} font-mono`} /></AdminField>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <select name="approvalStatus" defaultValue={s.approval_status} className={`${adminInput} w-auto`} aria-label="Approval status">
                    <option value="pending_approval">Pending organiser approval</option>
                    <option value="approved">Approved by organiser</option>
                  </select>
                  <AdminButton type="submit" name="intent" value="draft" variant="secondary">Save draft</AdminButton>
                  <AdminButton type="submit" name="intent" value="publish">Publish</AdminButton>
                  <span className="text-xs text-mist">Last published {formatNzDateTime(s.published_at)}</span>
                </div>
              </form>
              {s.draft && (
                <form action={discardDraft} className="mt-2"><input type="hidden" name="page" value={page} /><input type="hidden" name="key" value={s.key} /><button className="text-xs text-danger underline">Discard draft</button></form>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
