import { requirePermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import { AdminButton, AdminField, Card, Flash, PageHeader, StatusPill, adminInput } from "@/components/admin/ui";
import { deleteFaq, saveFaq } from "../partners/actions";

type F = { id: string; question: string; answer: string; category: string; sort_order: number; is_published: boolean; approval_status: string };

function FaqForm({ f }: { f?: F }) {
  return (
    <form action={saveFaq} className="grid gap-3 sm:grid-cols-4">
      {f && <input type="hidden" name="id" value={f.id} />}
      <AdminField label="Question" className="sm:col-span-4"><input name="question" defaultValue={f?.question} required className={adminInput} /></AdminField>
      <AdminField label="Answer" className="sm:col-span-4"><textarea name="answer" defaultValue={f?.answer} rows={3} required className={adminInput} /></AdminField>
      <AdminField label="Category"><select name="category" defaultValue={f?.category ?? "applying"} className={adminInput}>{["applying", "competition", "fees", "voting", "general"].map((c) => <option key={c}>{c}</option>)}</select></AdminField>
      <AdminField label="Order"><input name="sortOrder" type="number" min={0} defaultValue={f?.sort_order ?? 100} className={adminInput} /></AdminField>
      <AdminField label="Approval"><select name="approvalStatus" defaultValue={f?.approval_status ?? "pending_approval"} className={adminInput}><option value="pending_approval">Draft — pending approval</option><option value="approved">Approved</option></select></AdminField>
      <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" name="isPublished" defaultChecked={f?.is_published ?? true} /> Published</label>
      <div className="sm:col-span-4"><AdminButton type="submit">{f ? "Save" : "Add FAQ"}</AdminButton></div>
    </form>
  );
}

export default async function FaqAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission("content:write");
  const sp = await searchParams;
  const db = await createUserClient();
  const { data } = await db.from("faqs").select("*").order("sort_order");
  return (
    <>
      <PageHeader title="FAQs" description="Answers marked “pending approval” are labelled as drafts on the public site." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="space-y-4">
        {((data ?? []) as F[]).map((f) => (
          <Card key={f.id} title={f.question} actions={<div className="flex gap-2"><StatusPill tone={f.approval_status === "approved" ? "success" : "gold"}>{f.approval_status === "approved" ? "Approved" : "Draft"}</StatusPill><form action={deleteFaq}><input type="hidden" name="id" value={f.id} /><button className="text-xs text-danger underline">Delete</button></form></div>}>
            <FaqForm f={f} />
          </Card>
        ))}
        <Card title="Add FAQ"><FaqForm /></Card>
      </div>
    </>
  );
}
