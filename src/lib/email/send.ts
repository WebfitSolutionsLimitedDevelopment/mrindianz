import "server-only";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { EMAIL_TEMPLATE_DEFAULTS } from "./templates";
import { renderEmail } from "./render";

export type EmailResult =
  | { status: "sent" }
  | { status: "already_sent" }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

/**
 * Sends a templated email at most once per dedupeKey. Records every attempt in email_delivery_logs.
 * Returns "not_configured" when Resend/sender are not set — callers must NOT claim delivery then.
 */
export async function sendTemplatedEmail(opts: {
  templateKey: string;
  to: string;
  vars: Record<string, string | number | null | undefined>;
  dedupeKey: string;
}): Promise<EmailResult> {
  const env = serverEnv();
  const db = createServiceClient();
  let subjectTpl: string | undefined;
  let bodyTpl: string | undefined;

  if (db) {
    const { data: existing } = await db.from("email_delivery_logs").select("id, status, attempts").eq("dedupe_key", opts.dedupeKey).maybeSingle();
    if (existing?.status === "sent") return { status: "already_sent" };
    if (!existing) {
      const { error } = await db.from("email_delivery_logs").insert({ template_key: opts.templateKey, dedupe_key: opts.dedupeKey, recipient: opts.to, status: "pending" });
      if (error && error.code === "23505") {
        const { data: again } = await db.from("email_delivery_logs").select("status").eq("dedupe_key", opts.dedupeKey).maybeSingle();
        if (again?.status === "sent") return { status: "already_sent" };
      }
    }
    const { data: tpl } = await db.from("email_templates").select("subject, body").eq("key", opts.templateKey).maybeSingle();
    subjectTpl = tpl?.subject;
    bodyTpl = tpl?.body;
  }
  const fallback = EMAIL_TEMPLATE_DEFAULTS.find((t) => t.key === opts.templateKey);
  subjectTpl ??= fallback?.subject;
  bodyTpl ??= fallback?.body;
  if (!subjectTpl || !bodyTpl) throw new Error(`Unknown email template ${opts.templateKey}`);

  const update = async (patch: Record<string, unknown>) => {
    if (!db) return;
    const { data: row } = await db.from("email_delivery_logs").select("attempts").eq("dedupe_key", opts.dedupeKey).maybeSingle();
    await db.from("email_delivery_logs").update({ ...patch, attempts: (row?.attempts ?? 0) + (patch.status === "not_configured" ? 0 : 1) }).eq("dedupe_key", opts.dedupeKey);
  };

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    await update({ status: "not_configured" });
    if (process.env.NODE_ENV !== "production") console.info(`[email] not configured — skipped "${opts.templateKey}"`);
    return { status: "not_configured" };
  }

  const { subject, text, html } = renderEmail(subjectTpl, bodyTpl, opts.vars);
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send(
      { from: env.EMAIL_FROM, to: [opts.to], subject, text, html },
      { idempotencyKey: opts.dedupeKey.slice(0, 256) },
    );
    if (error) throw new Error(error.message);
    await update({ status: "sent", provider_message_id: data?.id ?? null, last_error: null });
    return { status: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 300) : "unknown error";
    await update({ status: "failed", last_error: msg });
    console.warn(`[email] send failed for template ${opts.templateKey}: ${msg}`);
    return { status: "failed", error: msg };
  }
}

/** Admin notification: never includes applicant personal details. */
export async function notifyAdmins(event: string, reference: string, dedupeKey: string) {
  const to = serverEnv().ADMIN_NOTIFICATION_EMAIL;
  if (!to) return { status: "not_configured" as const };
  return sendTemplatedEmail({ templateKey: "admin_notification", to, vars: { event, reference }, dedupeKey });
}
