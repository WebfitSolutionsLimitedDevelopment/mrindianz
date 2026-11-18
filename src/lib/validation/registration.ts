import { z } from "zod";
import { CANONICAL_REGIONS } from "@/lib/content/defaults";
import {
  checkbox, emailSchema, httpsUrl, mustAccept, normaliseInstagram, nzPhoneSchema, optionalTrimmed, trimmed, uuidSchema,
} from "./common";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_KINDS = ["headshot", "full_length", "traditional"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];
export const REQUIRED_PHOTO_KINDS: PhotoKind[] = ["headshot", "full_length"];

// ---------------------------------------------------------------------------
// Date of birth / eligibility
// ---------------------------------------------------------------------------
export interface AgePolicy {
  minimumAge: number;
  referenceDate: string; // YYYY-MM-DD (e.g. Grand Finale day)
  approved: boolean;
}

/** Whole years between an ISO date of birth and an ISO reference date (calendar arithmetic, no timezones). */
export function ageOn(dobIso: string, refIso: string): number {
  const [dy, dm, dd] = dobIso.split("-").map(Number);
  const [ry, rm, rd] = refIso.split("-").map(Number);
  let age = ry - dy;
  if (rm < dm || (rm === dm && rd < dd)) age -= 1;
  return age;
}

function isRealDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/**
 * Date-of-birth schema. The age rule is enforced ONLY when the organiser has approved the age policy
 * (brief: "minimum age validated after policy approval"). Sanity limits always apply.
 */
export const dateOfBirthSchema = (policy: AgePolicy) =>
  z
    .string({ error: "Date of birth is required" })
    .trim()
    .min(1, { error: "Date of birth is required" })
    .refine(isRealDate, { error: "Enter a valid date of birth" })
    .refine((v) => ageOn(v, policy.referenceDate) < 100 && ageOn(v, policy.referenceDate) >= 13, {
      error: "Enter a valid date of birth",
    })
    .refine((v) => !policy.approved || ageOn(v, policy.referenceDate) >= policy.minimumAge, {
      error: `You must be at least ${policy.minimumAge} on ${formatIsoDate(policy.referenceDate)} to apply`,
    });

function formatIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// Step 1 — Applicant details
// ---------------------------------------------------------------------------
export const applicantDetailsSchema = (policy: AgePolicy) =>
  z.object({
    legalName: trimmed(2, 120, "Full legal name"),
    stageName: optionalTrimmed(80, "Preferred public / stage name"),
    dateOfBirth: dateOfBirthSchema(policy),
    email: emailSchema,
    mobile: nzPhoneSchema,
    city: trimmed(2, 80, "City or town"),
    region: z.enum(CANONICAL_REGIONS, { error: "Select your region" }),
    occupation: optionalTrimmed(120, "Occupation / field of study"),
    instagram: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v, ctx) => {
        if (!v) return undefined;
        const n = normaliseInstagram(v);
        if (!n) {
          ctx.addIssue({ code: "custom", message: "Enter an Instagram handle (e.g. @yourname) or profile link" });
          return z.NEVER;
        }
        return n;
      }),
  });

// ---------------------------------------------------------------------------
// Step 2 — Personal story
// ---------------------------------------------------------------------------
export const STORY_MAX = 1000;

export const personalStorySchema = z
  .object({
    whyEnter: trimmed(1, STORY_MAX, "This answer"),
    kiwiIndianMeaning: trimmed(1, STORY_MAX, "This answer"),
    interests: optionalTrimmed(STORY_MAX, "Interests, achievements or community work"),
    hasExperience: z.enum(["yes", "no"]).optional(),
    experienceDetails: optionalTrimmed(STORY_MAX, "Experience details"),
    talentAudition: z.enum(["yes", "no"], { error: "Please choose Yes or No" }),
    talentDescription: optionalTrimmed(STORY_MAX, "Talent description"),
  })
  .refine((v) => v.talentAudition === "no" || !!v.talentDescription, {
    path: ["talentDescription"],
    error: "Describe your talent and any equipment you would need",
  });

// ---------------------------------------------------------------------------
// Step 3 — Photographs and media
// ---------------------------------------------------------------------------
export const photoMetadataSchema = z.object({
  kind: z.enum(PHOTO_KINDS),
  contentType: z.enum(ALLOWED_IMAGE_TYPES, { error: "Photos must be JPG, PNG or WEBP" }),
  size: z
    .number()
    .int()
    .positive({ error: "The file is empty" })
    .max(MAX_IMAGE_BYTES, { error: "Each photo must be 5 MB or smaller" }),
  uploadSessionId: uuidSchema,
});
export type PhotoMetadata = z.infer<typeof photoMetadataSchema>;

export const uploadedPhotoSchema = z.object({
  kind: z.enum(PHOTO_KINDS),
  path: z.string().regex(/^drafts\/[0-9a-f-]{36}\/(headshot|full_length|traditional)-[0-9a-f-]{36}\.(jpg|png|webp)$/, {
    error: "Invalid upload reference",
  }),
});

export const mediaSchema = z
  .object({
    photos: z.array(uploadedPhotoSchema).max(3),
    videoUrl: z
      .union([z.literal(""), httpsUrl("Introduction video link")])
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .refine((v) => REQUIRED_PHOTO_KINDS.every((k) => v.photos.some((p) => p.kind === k)), {
    path: ["photos"],
    error: "A recent headshot and a full-length photograph are required",
  })
  .refine((v) => new Set(v.photos.map((p) => p.kind)).size === v.photos.length, {
    path: ["photos"],
    error: "Only one photo per category",
  });

// ---------------------------------------------------------------------------
// Step 4 — Eligibility and consent
// ---------------------------------------------------------------------------
export const consentSchema = z.object({
  rehearsalAvailability: mustAccept("Confirm you can attend the 20–21 March 2027 rehearsal weekend"),
  finaleAvailability: mustAccept("Confirm you can attend the Grand Finale on 3 April 2027"),
  feeUnderstanding: mustAccept("Confirm you understand applying is free and the NZD $350 fee applies only if selected and accepted"),
  eligibility: mustAccept("Confirm you meet the eligibility criteria"),
  accuracy: mustAccept("Confirm the information and photographs are yours to submit and accurate"),
  terms: mustAccept("Confirm you have read the contestant terms"),
  privacy: mustAccept("Acknowledge the privacy notice"),
  marketing: checkbox.default(false),
});

// ---------------------------------------------------------------------------
// Full submission (validated again on the server)
// ---------------------------------------------------------------------------
export const applicationSubmissionSchema = (policy: AgePolicy) =>
  z.object({
    clientSubmissionId: uuidSchema,
    uploadSessionId: uuidSchema,
    details: applicantDetailsSchema(policy),
    story: personalStorySchema,
    media: mediaSchema,
    consent: consentSchema,
  });

export type ApplicationSubmission = z.infer<ReturnType<typeof applicationSubmissionSchema>>;

/** Detect the real image type from file bytes (never trust the browser's content-type). */
export function sniffImageType(bytes: Uint8Array): (typeof ALLOWED_IMAGE_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

export const EXT_FOR_TYPE: Record<(typeof ALLOWED_IMAGE_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
