"use server";
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import { faqSchema, partnerSchema } from "@/lib/validation/admin";
import { back, firstIssue } from "@/lib/admin/flash";

export async function savePartner(formData: FormData) {
  await assertPermission("content:write");
  const parsed = partnerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/partners", { error: firstIssue(parsed.error) });
  const v = parsed.data;
  const logo = String(formData.get("logoPath") ?? "") || null;
  if (logo && !/^partners\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(logo)) back("/admin/partners", { error: "Invalid logo." });
  const row = { name: v.name, category: v.category, description: v.description, url: v.url, sort_order: v.sortOrder, confirmed: v.confirmed, is_published: v.isPublished, logo_path: logo };
  const id = String(formData.get("id") ?? "");
  const db = await createUserClient();
  const { error } = id ? await db.from("partners").update(row).eq("id", id) : await db.from("partners").insert(row);
  if (error) back("/admin/partners", { error: "Save failed." });
  revalidatePath("/", "layout");
  back("/admin/partners", { ok: "Partner saved." });
}

export async function deletePartner(formData: FormData) {
  await assertPermission("content:write");
  const db = await createUserClient();
  await db.from("partners").delete().eq("id", String(formData.get("id")));
  revalidatePath("/", "layout");
  back("/admin/partners", { ok: "Partner deleted." });
}

export async function saveFaq(formData: FormData) {
  await assertPermission("content:write");
  const parsed = faqSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/faqs", { error: firstIssue(parsed.error) });
  const v = parsed.data;
  const row = { question: v.question, answer: v.answer, category: v.category, sort_order: v.sortOrder, is_published: v.isPublished, approval_status: v.approvalStatus };
  const id = String(formData.get("id") ?? "");
  const db = await createUserClient();
  const { error } = id ? await db.from("faqs").update(row).eq("id", id) : await db.from("faqs").insert(row);
  if (error) back("/admin/faqs", { error: "Save failed." });
  revalidatePath("/", "layout");
  back("/admin/faqs", { ok: "FAQ saved." });
}

export async function deleteFaq(formData: FormData) {
  await assertPermission("content:write");
  const db = await createUserClient();
  await db.from("faqs").delete().eq("id", String(formData.get("id")));
  revalidatePath("/", "layout");
  back("/admin/faqs", { ok: "FAQ deleted." });
}
