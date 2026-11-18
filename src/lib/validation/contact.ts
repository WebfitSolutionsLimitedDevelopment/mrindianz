import { z } from "zod";
import { emailSchema, trimmed } from "./common";

export const contactSchema = z.object({
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
