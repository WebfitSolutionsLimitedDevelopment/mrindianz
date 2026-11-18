import { z } from "zod";
import { emailSchema, trimmed } from "./common";

export const ENQUIRY_TYPES = ["General", "Applying", "Sponsorship & partnership", "Media", "People's Choice", "Tickets", "Website support"] as const;

export const contactSchema = z.object({
  enquiryType: z.enum(ENQUIRY_TYPES, { error: "Choose an enquiry type" }).default("General"),
  name: trimmed(2, 100, "Name"),
  email: emailSchema,
  subject: trimmed(2, 150, "Subject"),
  message: trimmed(10, 4000, "Message"),
  // Spam protection: honeypot must stay empty; form must not be submitted implausibly fast.
  website: z.string().max(0, { error: "Spam detected" }).optional().default(""),
  startedAt: z.coerce.number().int().positive(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const MIN_FORM_FILL_MS = 2500;
