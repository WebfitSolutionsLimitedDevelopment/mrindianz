"use server";

import { applicationSubmissionSchema, MAX_IMAGE_BYTES, sniffImageType, EXT_FOR_TYPE, type ApplicationSubmission } from "@/lib/validation/registration";
import { createServiceClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/content/repo";
import { getRegistrationState } from "@/lib/registration";
import { rateLimit } from "@/lib/security";
import { notifyAdmins, sendTemplatedEmail } from "@/lib/email/send";

export type SubmitResult =
  | { ok: true; reference: string; emailStatus: "sent" | "already_sent" | "not_configured" | "failed" | "unknown" }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const BUCKET = "application-media";

export async function submitApplication(payload: unknown): Promise<SubmitResult> {
  const reg = await getRegistrationState();
  if (reg.state !== "open") return { ok: false, error: "Applications are not currently open." };

  const settings = await getSettings();
  const policy = {
    minimumAge: settings.registration.minimumAge,
    referenceDate: settings.registration.ageReferenceDate,
    approved: settings.registration.agePolicyApproved,
  };
  const parsed = applicationSubmissionSchema(policy).safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, error: "Some details need attention. Please review each step.", fieldErrors };
  }
  const input: ApplicationSubmission = parsed.data;

  const db = createServiceClient();
  if (!db) return { ok: false, error: "Applications cannot be received right now. Please try again later." };

  // Duplicate submission (double click / retry after timeout): return the original reference.
  const existing = await db.from("applications").select("reference").eq("client_submission_id", input.clientSubmissionId).maybeSingle();
  if (existing.data) return { ok: true, reference: existing.data.reference, emailStatus: "unknown" };

  if (!(await rateLimit("apply-submit", 5, 3600))) {
    return { ok: false, error: "Too many applications from this connection. Please try again later." };
  }

  // Verify every uploaded file server-side: belongs to this upload session, exists, size and real type.
  const verified: { kind: string; path: string; mime: string; size: number }[] = [];
  for (const photo of input.media.photos) {
    if (!photo.path.startsWith(`drafts/${input.uploadSessionId}/${photo.kind}-`)) {
      return { ok: false, error: "A photo upload could not be verified. Please re-upload it.", fieldErrors: { "media.photos": "Please re-upload your photos." } };
    }
    const { data: blob, error } = await db.storage.from(BUCKET).download(photo.path);
    if (error || !blob) {
      return { ok: false, error: "We could not find one of your uploaded photos. Please re-upload it.", fieldErrors: { [`media.${photo.kind}`]: "Upload missing — please retry." } };
    }
    const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const type = sniffImageType(bytes);
    const ext = photo.path.split(".").pop();
    if (!type || blob.size > MAX_IMAGE_BYTES || EXT_FOR_TYPE[type] !== ext) {
      await db.storage.from(BUCKET).remove([photo.path]);
      return { ok: false, error: "One of your photos is not a valid JPG, PNG or WEBP under 5 MB.", fieldErrors: { [`media.${photo.kind}`]: "Invalid image — please choose another file." } };
    }
    verified.push({ kind: photo.kind, path: photo.path, mime: type, size: blob.size });
  }

  const d = input.details;
  const s = input.story;
  const now = new Date().toISOString();
  const { data: app, error: insertError } = await db
    .from("applications")
    .insert({
      client_submission_id: input.clientSubmissionId,
      legal_name: d.legalName,
      stage_name: d.stageName ?? null,
      date_of_birth: d.dateOfBirth,
      email: d.email,
      mobile: d.mobile,
      city: d.city,
      region: d.region,
      occupation: d.occupation ?? null,
      instagram: d.instagram ?? null,
      why_enter: s.whyEnter,
      kiwi_indian_meaning: s.kiwiIndianMeaning,
      interests: s.interests ?? null,
      has_experience: s.hasExperience === "yes",
      experience_details: s.experienceDetails ?? null,
      talent_audition: s.talentAudition === "yes",
      talent_description: s.talentAudition === "yes" ? s.talentDescription ?? null : null,
      video_url: input.media.videoUrl ?? null,
      consents: { ...input.consent, recorded_at: now },
      policy_versions: {
        contestant_terms: settings.legal.versions.contestantTerms,
        privacy: settings.legal.versions.privacy,
        eligibility_approved: settings.registration.eligibilityApproved,
        age_policy_approved: settings.registration.agePolicyApproved,
      },
      marketing_opt_in: input.consent.marketing,
      marketing_consent_at: input.consent.marketing ? now : null,
    })
    .select("id, reference")
    .single();

  if (insertError || !app) {
    if (insertError?.code === "23505") {
      const again = await db.from("applications").select("reference").eq("client_submission_id", input.clientSubmissionId).maybeSingle();
      if (again.data) return { ok: true, reference: again.data.reference, emailStatus: "unknown" };
    }
    console.warn(`[apply] insert failed: ${insertError?.code ?? "unknown"}`);
    return { ok: false, error: "We couldn't save your application. Please try again." };
  }

  // Move files out of the drafts area into the application's private folder.
  for (const f of verified) {
    const finalPath = `applications/${app.id}/${f.kind}.${EXT_FOR_TYPE[f.mime as keyof typeof EXT_FOR_TYPE]}`;
    const moved = await db.storage.from(BUCKET).move(f.path, finalPath);
    const storagePath = moved.error ? f.path : finalPath;
    const { error } = await db.from("application_media").insert({
      application_id: app.id, kind: f.kind, storage_path: storagePath, mime_type: f.mime, size_bytes: f.size,
    });
    if (error) console.warn(`[apply] media record failed: ${error.code}`);
  }

  const email = await sendTemplatedEmail({
    templateKey: "application_received",
    to: d.email,
    dedupeKey: `application_received:${app.id}`,
    vars: { first_name: (d.stageName ?? d.legalName).split(" ")[0], reference: app.reference },
  });
  await notifyAdmins("New Mr. IndiaNZ application received", app.reference, `admin_new_application:${app.id}`);

  return { ok: true, reference: app.reference, emailStatus: email.status === "failed" ? "failed" : email.status };
}
