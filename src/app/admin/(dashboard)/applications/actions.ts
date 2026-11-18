"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { applicationNoteSchema, statusChangeSchema } from "@/lib/validation/admin";
import { back, firstIssue } from "@/lib/admin/flash";
import { sendTemplatedEmail } from "@/lib/email/send";
import { audit } from "@/lib/audit";

export async function changeStatus(formData: FormData) {
  await assertPermission("applications:update");
  const returnTo = String(formData.get("returnTo") ?? "/admin/applications");
  const parsed = statusChangeSchema.safeParse({
    applicationIds: formData.getAll("applicationIds").map(String),
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) back(returnTo, { error: firstIssue(parsed.error) });
  const db = await createUserClient();
  const { data, error } = await db.rpc("change_application_status", { p_ids: parsed.data.applicationIds, p_status: parsed.data.status, p_note: parsed.data.note ?? null });
  if (error) back(returnTo, { error: "Status update failed." });
  revalidatePath("/admin/applications");
  back(returnTo, { ok: `${data ?? 0} application(s) updated.` });
}

export async function addNote(formData: FormData) {
  const session = await assertPermission("applications:update");
  const parsed = applicationNoteSchema.safeParse({ applicationId: formData.get("applicationId"), body: formData.get("body") });
  const path = `/admin/applications/${String(formData.get("applicationId"))}`;
  if (!parsed.success) back(path, { error: firstIssue(parsed.error) });
  const db = await createUserClient();
  const { error } = await db.from("application_notes").insert({ application_id: parsed.data.applicationId, author_id: session.userId, body: parsed.data.body });
  if (error) back(path, { error: "Could not save the note." });
  back(path, { ok: "Note added." });
}

const SENDABLE = ["application_shortlisted", "audition_invitation", "selection_offer", "acceptance_confirmation", "contestant_confirmation", "application_unsuccessful"] as const;

export async function sendApplicantEmail(formData: FormData) {
  const session = await assertPermission("applications:update");
  const id = String(formData.get("applicationId"));
  const key = String(formData.get("templateKey"));
  const path = `/admin/applications/${id}`;
  if (!(SENDABLE as readonly string[]).includes(key)) back(path, { error: "Unknown template." });
  const db = await createUserClient();
  const { data: app } = await db.from("applications").select("id, reference, legal_name, stage_name, email, anonymised_at").eq("id", id).maybeSingle();
  if (!app || app.anonymised_at) back(path, { error: "Application not found." });
  const extra = String(formData.get("details") ?? "").slice(0, 2000);
  const result = await sendTemplatedEmail({
    templateKey: key,
    to: app.email,
    dedupeKey: `${key}:${app.id}:${String(formData.get("nonce") ?? "")}`,
    vars: { first_name: (app.stage_name ?? app.legal_name).split(" ")[0], reference: app.reference, audition_details: extra, offer_details: extra },
  });
  await audit(session.userId, "email_sent", "applications", app.id, { template: key, result: result.status });
  const msg = result.status === "sent" ? "Email sent." : result.status === "already_sent" ? "This email was already sent." : result.status === "not_configured" ? "Email is not configured (Resend). Nothing was sent." : "Email failed — see Email logs.";
  back(path, result.status === "sent" || result.status === "already_sent" ? { ok: msg } : { error: msg });
}

export async function anonymiseApplication(formData: FormData) {
  const session = await assertPermission("applications:delete");
  const id = String(formData.get("applicationId"));
  if (formData.get("confirm") !== "DELETE") back(`/admin/applications/${id}`, { error: "Type DELETE to confirm." });
  const service = createServiceClient();
  const db = await createUserClient();
  const { data: media } = await db.from("application_media").select("storage_path").eq("application_id", id);
  if (service && media?.length) await service.storage.from("mrindianz-applications").remove(media.map((m) => m.storage_path));
  const { error } = await db.rpc("anonymise_application", { p_application_id: id });
  if (error) back(`/admin/applications/${id}`, { error: "Deletion failed." });
  await audit(session.userId, "applicant_data_deleted", "applications", id);
  back(`/admin/applications/${id}`, { ok: "Personal data and photographs deleted. A non-identifying record remains." });
}

export async function createContestantFromApplication(formData: FormData) {
  await assertPermission("contestants:write");
  const id = String(formData.get("applicationId"));
  const db = await createUserClient();
  const { data: app } = await db.from("applications").select("id, legal_name, stage_name, city, region").eq("id", id).maybeSingle();
  if (!app) back(`/admin/applications/${id}`, { error: "Application not found." });
  const existing = await db.from("contestants").select("id").eq("application_id", id).maybeSingle();
  if (existing.data) back(`/admin/contestants/${existing.data.id}`, { ok: "Contestant profile already exists." });
  const { count } = await db.from("contestants").select("id", { count: "exact", head: true });
  const slug = `contestant-${String((count ?? 0) + 1).padStart(2, "0")}-${crypto.randomUUID().slice(0, 4)}`;
  // Only the public name and city/region are copied. Private application data is never published automatically.
  const { data, error } = await db.from("contestants").insert({
    application_id: app.id, slug, public_name: app.stage_name ?? app.legal_name, city_region: `${app.city}, ${app.region}`, publication_status: "draft",
  }).select("id").single();
  if (error || !data) back(`/admin/applications/${id}`, { error: "Could not create contestant profile." });
  back(`/admin/contestants/${data.id}`, { ok: "Draft contestant profile created. Review it before publishing." });
}
