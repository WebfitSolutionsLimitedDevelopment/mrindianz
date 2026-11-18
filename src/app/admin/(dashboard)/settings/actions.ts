"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import {
  announcementSchema, contactSettingsSchema, eventSettingsSchema, legalSettingsSchema, registrationSettingsSchema, ticketSettingsSchema,
} from "@/lib/validation/admin";
import { back, firstIssue } from "@/lib/admin/flash";
import { DEFAULT_SETTINGS } from "@/lib/content/defaults";
import { nzLocalToIso } from "@/lib/format";
import { deepMerge } from "@/lib/content/repo";

const PATH = "/admin/settings";

async function writeSetting(key: string, value: unknown) {
  const db = await createUserClient();
  const { data: current } = await db.from("site_settings").select("published").eq("key", key).maybeSingle();
  const merged = deepMerge((current?.published ?? DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS]) as Record<string, unknown>, value);
  const { error } = await db.from("site_settings").upsert({ key, published: merged, published_at: new Date().toISOString() });
  if (error) back(PATH, { error: "Save failed." });
  revalidatePath("/", "layout");
}

export async function saveSettings(formData: FormData) {
  await assertPermission("settings:write");
  const section = String(formData.get("section"));
  const raw = Object.fromEntries(formData);
  switch (section) {
    case "event": {
      const p = eventSettingsSchema.safeParse(raw);
      if (!p.success) back(PATH, { error: firstIssue(p.error) });
      await writeSetting("event", p.data);
      break;
    }
    case "registration": {
      const opensAt = nzLocalToIso(String(raw.opensAt ?? ""));
      const closesAt = nzLocalToIso(String(raw.closesAt ?? ""));
      const p = registrationSettingsSchema.safeParse({ ...raw, opensAt, closesAt });
      if (!p.success || !opensAt || !closesAt) back(PATH, { error: p.success ? "Enter valid opening and closing times" : firstIssue(p.error) });
      if (Date.parse(p.data.closesAt) <= Date.parse(p.data.opensAt)) back(PATH, { error: "Closing must be after opening." });
      await writeSetting("registration", p.data);
      break;
    }
    case "contact": {
      const p = contactSettingsSchema.safeParse(raw);
      if (!p.success) back(PATH, { error: firstIssue(p.error) });
      const { email, phone, ...socials } = p.data;
      const db = await createUserClient();
      // socials replaced wholesale so removed links disappear
      const { error } = await db.from("site_settings").upsert({ key: "contact", published: { email, phone, socials: Object.fromEntries(Object.entries(socials).filter(([, v]) => !!v)) }, published_at: new Date().toISOString() });
      if (error) back(PATH, { error: "Save failed." });
      revalidatePath("/", "layout");
      break;
    }
    case "tickets": {
      const p = ticketSettingsSchema.safeParse(raw);
      if (!p.success) back(PATH, { error: firstIssue(p.error) });
      await writeSetting("tickets", p.data);
      break;
    }
    case "legal": {
      const p = legalSettingsSchema.safeParse(raw);
      if (!p.success) back(PATH, { error: firstIssue(p.error) });
      const v = p.data;
      await writeSetting("legal", {
        versions: { privacy: v.privacyVersion, websiteTerms: v.websiteTermsVersion, contestantTerms: v.contestantTermsVersion, votingRules: v.votingRulesVersion },
        approved: { privacy: v.privacyApproved, websiteTerms: v.websiteTermsApproved, contestantTerms: v.contestantTermsApproved, votingRules: v.votingRulesApproved },
      });
      break;
    }
    case "announcement": {
      const p = announcementSchema.safeParse(raw);
      if (!p.success) back(PATH, { error: firstIssue(p.error) });
      await writeSetting("announcement", p.data);
      break;
    }
    case "milestones": {
      const lines = String(raw.milestones ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
      const items = lines.map((l) => {
        const [date, label, confirmed] = l.split("|").map((x) => x.trim());
        return { date, label, confirmed: confirmed === "confirmed" };
      });
      const p = z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), label: z.string().min(2).max(160), confirmed: z.boolean() })).max(20).safeParse(items);
      if (!p.success) back(PATH, { error: "Milestones: use YYYY-MM-DD | Label | confirmed/proposed per line." });
      const db = await createUserClient();
      const { error } = await db.from("site_settings").upsert({ key: "milestones", published: p.data, published_at: new Date().toISOString() });
      if (error) back(PATH, { error: "Save failed." });
      revalidatePath("/", "layout");
      break;
    }
    case "media": {
      const url = z.union([z.literal(""), z.string().url().refine((u) => u.startsWith("https://"), { error: "Images must use https://" })]).transform((v) => v || null);
      const p = z.object({ heroImage: url, heroVideo: url, ctaImage: url, legacy: z.string().max(5000) }).safeParse(raw);
      if (!p.success) back(PATH, { error: firstIssue(p.error) });
      const legacy = p.data.legacy.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const [src, caption, alt] = l.split("|").map((x) => x.trim());
        return { src, caption: caption ?? "", alt: alt || caption || "" };
      });
      if (legacy.some((m) => !/^https:\/\//.test(m.src))) back(PATH, { error: "Each photo line must start with an https:// image URL." });
      const db = await createUserClient();
      const { error } = await db.from("site_settings").upsert({ key: "media", published: { heroImage: p.data.heroImage, heroVideo: p.data.heroVideo, ctaImage: p.data.ctaImage, legacy: legacy.slice(0, 12) }, published_at: new Date().toISOString() });
      if (error) back(PATH, { error: "Save failed." });
      revalidatePath("/", "layout");
      break;
    }
    default:
      back(PATH, { error: "Unknown settings section." });
  }
  back(PATH, { ok: "Settings saved and published." });
}
