import { revalidatePath } from "next/cache";
import { requirePermission, assertPermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import { Card, PageHeader, StatusPill } from "@/components/admin/ui";
import { formatNzDateTime } from "@/lib/format";

async function setStatus(formData: FormData) {
  "use server";
  await assertPermission("contact:read");
  const status = String(formData.get("status"));
  if (!["new", "read", "replied", "spam", "archived"].includes(status)) return;
  const db = await createUserClient();
  await db.from("contact_submissions").update({ status }).eq("id", String(formData.get("id")));
  revalidatePath("/admin/messages");
}

const TYPES = ["General", "Applying", "Sponsorship & partnership", "Media", "People's Choice", "Tickets", "Website support"];

export default async function Messages({ searchParams }: { searchParams: Promise<{ type?: string; status?: string }> }) {
  await requirePermission("contact:read");
  const sp = await searchParams;
  const db = await createUserClient();
  let q = db.from("contact_submissions").select("*").order("created_at", { ascending: false }).limit(200);
  q = sp.status === "archived" ? q.eq("status", "archived") : q.neq("status", "archived");
  if (sp.type && TYPES.includes(sp.type)) q = q.like("subject", `[${sp.type}]%`);
  const { data } = await q;
  return (
    <>
      <PageHeader title="Enquiries" description="Messages from the website contact form, including sponsorship and partnership enquiries. Each one is also emailed to the organiser inbox when email is configured." />
      <nav className="mb-6 flex flex-wrap gap-2 text-xs" aria-label="Filter enquiries">
        <a href="/admin/messages" className={`rounded-full border px-3 py-1.5 ${!sp.type && !sp.status ? "border-gold text-gold" : "border-line"}`}>All open</a>
        {TYPES.map((t) => <a key={t} href={`/admin/messages?type=${encodeURIComponent(t)}`} className={`rounded-full border px-3 py-1.5 ${sp.type === t ? "border-gold text-gold" : "border-line"}`}>{t}</a>)}
        <a href="/admin/messages?status=archived" className={`rounded-full border px-3 py-1.5 ${sp.status === "archived" ? "border-gold text-gold" : "border-line"}`}>Archived</a>
      </nav>
      <div className="space-y-4">
        {(data ?? []).map((m) => (
          <Card key={m.id} title={m.subject} actions={<StatusPill tone={m.status === "new" ? "gold" : "neutral"}>{m.status}</StatusPill>}>
            <p className="text-sm text-mist">{m.name} · <a className="text-gold underline" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>{m.email}</a> · {formatNzDateTime(m.created_at)}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm">{m.message}</p>
            <form action={setStatus} className="mt-3 flex flex-wrap gap-2 text-xs">
              <input type="hidden" name="id" value={m.id} />
              {["read", "replied", "spam", "archived"].map((s) => <button key={s} name="status" value={s} className="rounded border border-line px-2 py-1 hover:border-gold">Mark {s}</button>)}
            </form>
          </Card>
        ))}
        {!data?.length && <p className="text-mist">No messages.</p>}
      </div>
    </>
  );
}
