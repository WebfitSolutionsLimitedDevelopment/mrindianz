"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import { parseItems, sectionSchema } from "@/lib/validation/admin";
import { back, firstIssue } from "@/lib/admin/flash";

export async function saveSection(formData: FormData) {
  await assertPermission("content:write");
  const parsed = sectionSchema.safeParse(Object.fromEntries(formData));
  const ret = `/admin/content?page=${encodeURIComponent(String(formData.get("page") ?? "home"))}`;
  if (!parsed.success) back(ret, { error: firstIssue(parsed.error) });
  const v = parsed.data;
  const items = parseItems(v.items);
  const content = { title: v.title, body: v.body.replace(/\r\n/g, "\n"), ...(items.length ? { items } : {}) };
  const db = await createUserClient();
  const patch = v.intent === "publish"
    ? { draft: null, published: content, approval_status: v.approvalStatus, published_at: new Date().toISOString() }
    : { draft: content, approval_status: v.approvalStatus };
  const { error } = await db.from("content_sections").update(patch).eq("page_slug", v.page).eq("key", v.key);
  if (error) back(ret, { error: "Save failed." });
  revalidatePath("/", "layout");
  back(ret, { ok: v.intent === "publish" ? `“${v.title}” published.` : `Draft saved for “${v.title}” (not yet live).` });
}

export async function discardDraft(formData: FormData) {
  await assertPermission("content:write");
  const page = String(formData.get("page"));
  const db = await createUserClient();
  await db.from("content_sections").update({ draft: null }).eq("page_slug", page).eq("key", String(formData.get("key")));
  back(`/admin/content?page=${encodeURIComponent(page)}`, { ok: "Draft discarded." });
}
