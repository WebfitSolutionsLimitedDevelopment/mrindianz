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

export default async function Messages() {
  await requirePermission("contact:read");
  const db = await createUserClient();
  const { data } = await db.from("contact_submissions").select("*").neq("status", "archived").order("created_at", { ascending: false }).limit(100);
  return (
    <>
      <PageHeader title="Contact messages" description="Messages from the public contact form." />
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
