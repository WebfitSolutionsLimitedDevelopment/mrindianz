"use server";

import { contactSchema, MIN_FORM_FILL_MS } from "@/lib/validation/contact";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security";
import { notifyAdmins, sendTemplatedEmail } from "@/lib/email/send";

export type ContactState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; emailed: boolean };

export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    if (fieldErrors.website) return { status: "success", emailed: false }; // silently drop bots
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;
  if (Date.now() - input.startedAt < MIN_FORM_FILL_MS) return { status: "success", emailed: false }; // too fast: bot

  if (!(await rateLimit("contact", 5, 3600))) {
    return { status: "error", message: "Too many messages from this connection. Please try again later." };
  }

  const db = createServiceClient();
  if (!db) return { status: "error", message: "The contact form is not available yet. Please try again later." };

  const { data, error } = await db
    .from("contact_submissions")
    .insert({ name: input.name, email: input.email, subject: `[${input.enquiryType}] ${input.subject}`.slice(0, 150), message: input.message })
    .select("id")
    .single();
  if (error || !data) {
    console.warn(`[contact] insert failed: ${error?.code ?? "unknown"}`);
    return { status: "error", message: "We couldn't send your message. Please try again." };
  }

  const ack = await sendTemplatedEmail({
    templateKey: "contact_acknowledgement", to: input.email, dedupeKey: `contact_ack:${data.id}`,
    vars: { name: input.name.split(" ")[0], subject: input.subject },
  });
  await notifyAdmins({
    templateKey: "admin_contact_enquiry",
    dedupeKey: `contact_admin:${data.id}`,
    replyTo: input.email,
    vars: { enquiry_type: input.enquiryType, name: input.name, email: input.email, subject: input.subject, message: input.message },
  });
  return { status: "success", emailed: ack.status === "sent" };
}
