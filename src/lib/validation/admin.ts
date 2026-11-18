import { z } from "zod";
import { checkbox, emailSchema, httpsUrl, trimmed } from "./common";

export const APPLICATION_STATUSES = [
  "new", "in_review", "shortlisted", "offered", "accepted", "awaiting_payment", "confirmed", "waitlisted", "unsuccessful", "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "New",
  in_review: "In Review",
  shortlisted: "Shortlisted / Audition",
  offered: "Offered",
  accepted: "Accepted",
  awaiting_payment: "Awaiting Payment",
  confirmed: "Confirmed",
  waitlisted: "Waitlisted",
  unsuccessful: "Unsuccessful",
  withdrawn: "Withdrawn",
};

export const statusChangeSchema = z.object({
  applicationIds: z.array(z.uuid()).min(1).max(200),
  status: z.enum(APPLICATION_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export const applicationNoteSchema = z.object({
  applicationId: z.uuid(),
  body: trimmed(1, 4000, "Note"),
});

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "Use lowercase letters, numbers and hyphens" })
  .max(60);

const socialUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || undefined)
  .refine((v) => !v || /^https:\/\/(www\.)?(instagram\.com|facebook\.com|tiktok\.com|youtube\.com|x\.com|linkedin\.com)\//i.test(v), {
    error: "Must be an https link to Instagram, Facebook, TikTok, YouTube, X or LinkedIn",
  });

export const contestantProfileSchema = z.object({
  slug: slugSchema.optional(),
  contestantNumber: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(999)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  publicName: trimmed(2, 80, "Public name"),
  shortBio: z.string().trim().max(280).optional().transform((v) => v || null),
  biography: z.string().trim().max(5000).optional().transform((v) => v || null),
  cityRegion: z.string().trim().max(80).optional().transform((v) => v || null),
  interests: z
    .string()
    .optional()
    .transform((v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12)),
  talentInfo: z.string().trim().max(1000).optional().transform((v) => v || null),
  instagram: socialUrl,
  facebook: socialUrl,
  tiktok: socialUrl,
  youtube: socialUrl,
  publicationStatus: z.enum(["draft", "published", "archived"]),
  votingEligible: checkbox.default(false),
  applicationId: z.union([z.literal(""), z.uuid()]).optional().transform((v) => v || null),
});

export const faqSchema = z.object({
  question: trimmed(3, 300, "Question"),
  answer: trimmed(1, 4000, "Answer"),
  category: trimmed(2, 40, "Category"),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  isPublished: checkbox.default(false),
  approvalStatus: z.enum(["approved", "pending_approval"]),
});

export const partnerSchema = z.object({
  name: trimmed(2, 120, "Partner name"),
  category: z.enum(["presenting", "major", "supporting", "media", "community"]),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
  url: z.union([z.literal(""), httpsUrl("Website")]).optional().transform((v) => v || null),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  confirmed: checkbox.default(false),
  isPublished: checkbox.default(false),
}).refine((v) => !v.isPublished || v.confirmed, { path: ["isPublished"], error: "Only confirmed partners can be published" });

export const sectionSchema = z.object({
  page: z.string().regex(/^[a-z0-9-]+$/),
  key: z.string().regex(/^[a-z0-9_]+$/),
  title: trimmed(1, 200, "Title"),
  body: z.string().max(10_000),
  items: z.string().max(20_000).optional(), // "Title | Body" per line
  approvalStatus: z.enum(["approved", "pending_approval"]),
  intent: z.enum(["draft", "publish"]),
});

export function parseItems(raw: string | undefined) {
  return (raw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [title, ...rest] = l.split("|");
      return { title: title.trim(), body: rest.join("|").trim() };
    })
    .filter((i) => i.title);
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use YYYY-MM-DD" });

export const eventSettingsSchema = z.object({
  name: trimmed(2, 80, "Event name"),
  shortDescription: trimmed(10, 300, "Description"),
  tagline: trimmed(2, 120, "Tagline"),
  taglineApproved: checkbox.default(false),
  finaleDate: isoDate,
  finaleDisplay: trimmed(4, 60, "Finale display"),
  venueName: trimmed(2, 80, "Venue"),
  venueAddress: trimmed(2, 200, "Venue address"),
  venueShort: trimmed(2, 60, "Venue short name"),
  rehearsalStart: isoDate,
  rehearsalEnd: isoDate,
  rehearsalDisplay: trimmed(4, 80, "Rehearsal display"),
  organiser: trimmed(2, 120, "Organiser"),
  contestantFeeTermsApproved: checkbox.default(false),
  countdownEnabled: checkbox.default(false),
});

export const registrationSettingsSchema = z.object({
  opensAt: z.string().min(1),
  closesAt: z.string().min(1),
  datesApproved: checkbox.default(false),
  minimumAge: z.coerce.number().int().min(16).max(30),
  ageReferenceDate: isoDate,
  agePolicyApproved: checkbox.default(false),
  eligibilityApproved: checkbox.default(false),
});

export const contactSettingsSchema = z.object({
  email: z.union([z.literal(""), emailSchema]).optional().transform((v) => v || null),
  phone: z.string().trim().max(30).optional().transform((v) => v || null),
  instagram: z.union([z.literal(""), httpsUrl("Instagram")]).optional().transform((v) => v || undefined),
  facebook: z.union([z.literal(""), httpsUrl("Facebook")]).optional().transform((v) => v || undefined),
  tiktok: z.union([z.literal(""), httpsUrl("TikTok")]).optional().transform((v) => v || undefined),
  youtube: z.union([z.literal(""), httpsUrl("YouTube")]).optional().transform((v) => v || undefined),
});

export const ticketSettingsSchema = z.object({
  url: z.union([z.literal(""), httpsUrl("Ticketing URL")]).optional().transform((v) => v || null),
  note: z.string().trim().max(300),
});

export const legalSettingsSchema = z.object({
  privacyVersion: trimmed(1, 40, "Version"),
  websiteTermsVersion: trimmed(1, 40, "Version"),
  contestantTermsVersion: trimmed(1, 40, "Version"),
  votingRulesVersion: trimmed(1, 40, "Version"),
  privacyApproved: checkbox.default(false),
  websiteTermsApproved: checkbox.default(false),
  contestantTermsApproved: checkbox.default(false),
  votingRulesApproved: checkbox.default(false),
});

export const announcementSchema = z.object({
  enabled: checkbox.default(false),
  text: z.string().trim().max(200),
  href: z.union([z.literal(""), z.string().regex(/^(\/[a-z0-9\-/]*|https:\/\/.+)$/)]).optional().transform((v) => v || null),
});

export const emailTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  subject: trimmed(2, 200, "Subject"),
  body: trimmed(2, 10_000, "Body"),
});

export const adminInviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["super_admin", "organiser_admin", "content_editor", "application_reviewer", "finance_viewer"]),
});
