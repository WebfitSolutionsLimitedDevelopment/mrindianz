"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import { contestantProfileSchema } from "@/lib/validation/admin";
import { back, firstIssue } from "@/lib/admin/flash";
import { z } from "zod";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

export async function saveContestant(formData: FormData) {
  await assertPermission("contestants:write");
  const id = String(formData.get("id") ?? "");
  const path = id ? `/admin/contestants/${id}` : "/admin/contestants/new";
  const parsed = contestantProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(path, { error: firstIssue(parsed.error) });
  const v = parsed.data;
  const imagePath = String(formData.get("profileImagePath") ?? "") || null;
  if (imagePath && !/^contestants\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(imagePath)) back(path, { error: "Invalid image reference." });

  const row = {
    contestant_number: v.contestantNumber,
    public_name: v.publicName,
    short_bio: v.shortBio,
    biography: v.biography,
    city_region: v.cityRegion,
    interests: v.interests,
    talent_info: v.talentInfo,
    social_links: Object.fromEntries(Object.entries({ instagram: v.instagram, facebook: v.facebook, tiktok: v.tiktok, youtube: v.youtube }).filter(([, x]) => !!x)),
    profile_image_path: imagePath,
    publication_status: v.publicationStatus,
    voting_eligible: v.publicationStatus === "published" && v.votingEligible,
  };

  const db = await createUserClient();
  if (id) {
    const { error } = await db.from("contestants").update(row).eq("id", id);
    if (error) back(path, { error: error.code === "23505" ? "That contestant number is already in use." : "Save failed." });
    revalidatePath("/contestants");
    revalidatePath("/", "layout");
    back(path, { ok: "Saved." });
  }
  // Permanent slug: chosen once at creation and never changed (QR codes keep working after renames).
  const slug = v.slug || (v.contestantNumber ? `contestant-${String(v.contestantNumber).padStart(2, "0")}` : slugify(v.publicName));
  const { data, error } = await db.from("contestants").insert({ ...row, slug }).select("id").single();
  if (error || !data) back(path, { error: error?.code === "23505" ? "That URL slug or contestant number is already in use." : "Create failed." });
  revalidatePath("/contestants");
  back(`/admin/contestants/${data.id}`, { ok: "Contestant created." });
}

const galleryItem = z.object({ contestantId: z.uuid(), path: z.string().regex(/^contestants\/[0-9a-f-]{36}\.(jpg|png|webp)$/), alt: z.string().trim().min(3, { error: "Alt text is required" }).max(200) });

export async function addGalleryImage(formData: FormData) {
  await assertPermission("contestants:write");
  const parsed = galleryItem.safeParse({ contestantId: formData.get("contestantId"), path: formData.get("galleryPath"), alt: formData.get("alt") });
  const path = `/admin/contestants/${String(formData.get("contestantId"))}`;
  if (!parsed.success) back(path, { error: firstIssue(parsed.error) });
  const db = await createUserClient();
  const { error } = await db.from("contestant_media").insert({ contestant_id: parsed.data.contestantId, storage_path: parsed.data.path, alt_text: parsed.data.alt, sort_order: Number(formData.get("sortOrder") ?? 0) || 0 });
  if (error) back(path, { error: "Could not add image." });
  revalidatePath("/contestants", "layout");
  back(path, { ok: "Gallery image added." });
}

export async function removeGalleryImage(formData: FormData) {
  await assertPermission("contestants:write");
  const db = await createUserClient();
  const contestantId = String(formData.get("contestantId"));
  await db.from("contestant_media").delete().eq("id", String(formData.get("mediaId"))).eq("contestant_id", contestantId);
  revalidatePath("/contestants", "layout");
  back(`/admin/contestants/${contestantId}`, { ok: "Image removed from gallery." });
}
