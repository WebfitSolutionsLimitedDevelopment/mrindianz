import { describe, expect, it } from "vitest";
import { normaliseInstagram, normaliseNzPhone } from "@/lib/validation/common";
import {
  ageOn, applicantDetailsSchema, consentSchema, mediaSchema, personalStorySchema, photoMetadataSchema, sniffImageType,
} from "@/lib/validation/registration";
import { contactSchema } from "@/lib/validation/contact";
import { voteCheckoutSchema } from "@/lib/validation/voting";

const policy = { minimumAge: 18, referenceDate: "2027-04-03", approved: true };
const validDetails = { legalName: "Arjun Sharma", dateOfBirth: "2000-05-10", email: "Arjun@Example.com", mobile: "021 123 4567", city: "Auckland", region: "Auckland" };

describe("NZ phone numbers", () => {
  it.each([
    ["021 123 4567", "+64211234567"], ["0211234567", "+64211234567"], ["+64 21 123 4567", "+64211234567"], ["0064 22 123 4567", "+64221234567"],
    ["(09) 123 4567", "+6491234567"], ["027-123-45678", "+642712345678"], ["+61 412 345 678", "+61412345678"],
  ])("accepts %s", (input, expected) => expect(normaliseNzPhone(input)).toBe(expected));
  it.each(["12345", "021", "abc", "0211234567890123", "+64 21", "02x 123 4567", ""])("rejects %s", (input) => expect(normaliseNzPhone(input)).toBeNull());
});

describe("age policy", () => {
  it("calculates age on the reference date", () => {
    expect(ageOn("2009-04-03", "2027-04-03")).toBe(18);
    expect(ageOn("2009-04-04", "2027-04-03")).toBe(17);
    expect(ageOn("2008-02-29", "2027-04-03")).toBe(19);
  });
  it("enforces the minimum age only when the policy is approved", () => {
    const under = { ...validDetails, dateOfBirth: "2009-04-04" };
    expect(applicantDetailsSchema(policy).safeParse(under).success).toBe(false);
    expect(applicantDetailsSchema({ ...policy, approved: false }).safeParse(under).success).toBe(true);
    expect(applicantDetailsSchema(policy).safeParse({ ...validDetails, dateOfBirth: "2009-04-03" }).success).toBe(true);
  });
  it("rejects impossible dates", () => {
    for (const d of ["2001-02-30", "2027-13-01", "not-a-date", "1900-01-01", "2026-01-01"]) {
      expect(applicantDetailsSchema({ ...policy, approved: false }).safeParse({ ...validDetails, dateOfBirth: d }).success).toBe(false);
    }
  });
});

describe("step 1 — applicant details", () => {
  it("normalises valid input", () => {
    const r = applicantDetailsSchema(policy).parse({ ...validDetails, instagram: "https://www.instagram.com/arjun.s/" });
    expect(r.email).toBe("arjun@example.com");
    expect(r.mobile).toBe("+64211234567");
    expect(r.instagram).toBe("@arjun.s");
  });
  it("requires required fields with clear messages", () => {
    const r = applicantDetailsSchema(policy).safeParse({});
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    for (const f of ["legalName", "dateOfBirth", "email", "mobile", "city", "region"]) expect(paths).toContain(f);
  });
  it("validates email and region", () => {
    expect(applicantDetailsSchema(policy).safeParse({ ...validDetails, email: "not-an-email" }).success).toBe(false);
    expect(applicantDetailsSchema(policy).safeParse({ ...validDetails, region: "Narnia" }).success).toBe(false);
  });
});

describe("step 2 — personal story", () => {
  const base = { whyEnter: "Because", kiwiIndianMeaning: "Everything", talentAudition: "no" };
  it("requires a talent description only when auditioning for Mr. Talent", () => {
    expect(personalStorySchema.safeParse(base).success).toBe(true);
    const r = personalStorySchema.safeParse({ ...base, talentAudition: "yes" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].path).toEqual(["talentDescription"]);
    expect(personalStorySchema.safeParse({ ...base, talentAudition: "yes", talentDescription: "Tabla" }).success).toBe(true);
  });
  it("enforces the 1,000 character limit", () => {
    expect(personalStorySchema.safeParse({ ...base, whyEnter: "x".repeat(1001) }).success).toBe(false);
  });
  it("requires a Yes/No choice for Mr. Talent", () => {
    expect(personalStorySchema.safeParse({ whyEnter: "a", kiwiIndianMeaning: "b" }).success).toBe(false);
  });
});

describe("step 3 — photos", () => {
  const sid = "11111111-1111-4111-8111-111111111111";
  it("restricts type and size", () => {
    expect(photoMetadataSchema.safeParse({ kind: "headshot", contentType: "image/jpeg", size: 1000, uploadSessionId: sid }).success).toBe(true);
    expect(photoMetadataSchema.safeParse({ kind: "headshot", contentType: "image/gif", size: 1000, uploadSessionId: sid }).success).toBe(false);
    expect(photoMetadataSchema.safeParse({ kind: "headshot", contentType: "image/png", size: 5 * 1024 * 1024 + 1, uploadSessionId: sid }).success).toBe(false);
    expect(photoMetadataSchema.safeParse({ kind: "headshot", contentType: "application/pdf", size: 10, uploadSessionId: sid }).success).toBe(false);
  });
  it("requires headshot and full-length photos with valid upload paths", () => {
    const p = (kind: string) => ({ kind, path: `drafts/${sid}/${kind}-22222222-2222-4222-8222-222222222222.jpg` });
    expect(mediaSchema.safeParse({ photos: [p("headshot")] }).success).toBe(false);
    expect(mediaSchema.safeParse({ photos: [p("headshot"), p("full_length")] }).success).toBe(true);
    expect(mediaSchema.safeParse({ photos: [p("headshot"), p("full_length")], videoUrl: "http://insecure.example.com" }).success).toBe(false);
    expect(mediaSchema.safeParse({ photos: [p("headshot"), { kind: "full_length", path: "applications/other/../../x.jpg" }] }).success).toBe(false);
  });
  it("detects real image types from bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });
});

describe("step 4 — consent", () => {
  const all = { rehearsalAvailability: true, finaleAvailability: true, feeUnderstanding: true, eligibility: true, accuracy: true, terms: true, privacy: true };
  it("requires every mandatory declaration and defaults marketing to false", () => {
    const ok = consentSchema.parse(all);
    expect(ok.marketing).toBe(false);
    for (const k of Object.keys(all)) expect(consentSchema.safeParse({ ...all, [k]: false }).success).toBe(false);
  });
});

describe("contact form", () => {
  const base = { name: "Priya", email: "p@example.com", subject: "Hello", message: "A message long enough", startedAt: Date.now() };
  it("accepts valid input and rejects the honeypot", () => {
    expect(contactSchema.safeParse(base).success).toBe(true);
    expect(contactSchema.safeParse({ ...base, website: "http://spam" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, message: "short" }).success).toBe(false);
  });
});

describe("vote checkout", () => {
  const ids = { idempotencyKey: crypto.randomUUID(), campaignId: crypto.randomUUID(), contestantId: crypto.randomUUID(), packageId: crypto.randomUUID() };
  it("strips tampered price and vote fields", () => {
    const r = voteCheckoutSchema.parse({ ...ids, quantity: 2, supporterName: "A", supporterEmail: "a@b.co", acceptTerms: true, priceCents: 1, votes: 999999, total: 0 });
    expect(r).not.toHaveProperty("priceCents");
    expect(r).not.toHaveProperty("votes");
    expect(r).not.toHaveProperty("total");
  });
  it("requires terms acceptance and a sane quantity", () => {
    expect(voteCheckoutSchema.safeParse({ ...ids, quantity: 1, supporterName: "A", supporterEmail: "a@b.co", acceptTerms: false }).success).toBe(false);
    expect(voteCheckoutSchema.safeParse({ ...ids, quantity: 0, supporterName: "A", supporterEmail: "a@b.co", acceptTerms: true }).success).toBe(false);
    expect(voteCheckoutSchema.safeParse({ ...ids, quantity: 1.5, supporterName: "A", supporterEmail: "a@b.co", acceptTerms: true }).success).toBe(false);
  });
  it("supports anonymous display", () => {
    expect(voteCheckoutSchema.parse({ ...ids, quantity: 1, supporterName: "A", supporterEmail: "a@b.co", acceptTerms: true, displayAnonymously: "on" }).displayAnonymously).toBe(true);
  });
});

describe("instagram", () => {
  it("normalises handles and rejects other URLs", () => {
    expect(normaliseInstagram("@my.handle")).toBe("@my.handle");
    expect(normaliseInstagram("instagram.com/abc")).toBe("@abc");
    expect(normaliseInstagram("https://evil.com/abc")).toBeNull();
  });
});
