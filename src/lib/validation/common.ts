import { z } from "zod";

export const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, { error: min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters` })
    .max(max, { error: `${label} must be ${max} characters or fewer` });

export const optionalTrimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} must be ${max} characters or fewer` })
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .max(254, { error: "Email is too long" })
  .pipe(z.email({ error: "Enter a valid email address" }));

/**
 * New Zealand phone numbers. Accepts common local formats ("021 123 4567", "(09) 123 4567",
 * "+64 21 123 4567", "0064 21 ...") and returns E.164 (+6421...). Also accepts other
 * international numbers in +CC format (8–15 digits) for applicants with overseas mobiles.
 */
export function normaliseNzPhone(input: string): string | null {
  const raw = input.trim();
  if (!/^[+(\d][\d\s().-]*$/.test(raw)) return null;
  let digits = raw.replace(/[\s().-]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+64")) digits = `0${digits.slice(3)}`;
  if (digits.startsWith("+")) {
    return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
  }
  // NZ mobile: 02X followed by 6–8 digits (020–029). Landline: 0[3-9] + 7 digits. Freephone 0800/0508.
  if (/^02\d{7,9}$/.test(digits) || /^0[3-9]\d{7}$/.test(digits) || /^0(800|508)\d{6,7}$/.test(digits)) {
    return `+64${digits.slice(1)}`;
  }
  return null;
}

export const nzPhoneSchema = z
  .string({ error: "Mobile number is required" })
  .trim()
  .min(1, { error: "Mobile number is required" })
  .transform((v, ctx) => {
    const n = normaliseNzPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Enter a valid NZ mobile number, e.g. 021 123 4567" });
      return z.NEVER;
    }
    return n;
  });

export const httpsUrl = (label: string, max = 500) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} is too long` })
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" && !!u.hostname.includes(".");
      } catch {
        return false;
      }
    }, { error: `${label} must be a valid https:// link` });

/** Instagram handle or profile URL → normalised "@handle". */
export function normaliseInstagram(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const m = v.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i) ?? v.match(/^@?([A-Za-z0-9._]{1,30})$/);
  return m ? `@${m[1]}` : null;
}

export const uuidSchema = z.uuid({ error: "Invalid identifier" });

/** Accepts checkbox values from forms and JSON. */
export const checkbox = z.union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false")]).transform((v) => v === true || v === "on" || v === "true");

export const mustAccept = (message: string) =>
  checkbox.refine((v) => v === true, { error: message });
