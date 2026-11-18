"use client";

import { useActionState, useState } from "react";
import { submitContact, type ContactState } from "@/app/(site)/contact/actions";
import { Button } from "@/components/ui/button";
import { Field, describedBy, inputClasses } from "./field";
import { ENQUIRY_TYPES } from "@/lib/validation/contact";

export function ContactForm({ defaultSubject }: { defaultSubject?: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, { status: "idle" });
  const [startedAt] = useState(() => Date.now());
  const fe = state.status === "error" ? state.fieldErrors ?? {} : {};

  if (state.status === "success") {
    return (
      <div role="status" className="rounded-2xl bg-ivory-2 p-8">
        <h2 className="text-3xl">Thank you — your message has been received.</h2>
        <p className="mt-3 text-stone">{state.emailed ? "We've sent a confirmation to your email address." : "We'll reply to the email address you provided as soon as possible."}</p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-6">
      {state.status === "error" && <p role="alert" className="border border-danger-ink/60 p-4 text-danger-ink">{state.message}</p>}
      <input type="hidden" name="startedAt" value={startedAt} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Leave this field empty<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="c-name" label="Name" required error={fe.name}>
          <input id="c-name" name="name" required maxLength={100} autoComplete="name" className={inputClasses} aria-invalid={!!fe.name} aria-describedby={describedBy("c-name", null, fe.name)} />
        </Field>
        <Field id="c-email" label="Email" required error={fe.email}>
          <input id="c-email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" className={inputClasses} aria-invalid={!!fe.email} aria-describedby={describedBy("c-email", null, fe.email)} />
        </Field>
      </div>
      <Field id="c-type" label="Enquiry type" required error={fe.enquiryType}>
        <select id="c-type" name="enquiryType" defaultValue={/partner|sponsor/i.test(defaultSubject ?? "") ? "Sponsorship & partnership" : /interest|apply/i.test(defaultSubject ?? "") ? "Applying" : "General"} className={inputClasses}>
          {ENQUIRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field id="c-subject" label="Subject" required error={fe.subject}>
        <input id="c-subject" name="subject" required maxLength={150} defaultValue={defaultSubject} className={inputClasses} aria-invalid={!!fe.subject} aria-describedby={describedBy("c-subject", null, fe.subject)} />
      </Field>
      <Field id="c-message" label="Message" required error={fe.message}>
        <textarea id="c-message" name="message" required minLength={10} maxLength={4000} rows={7} className={inputClasses} aria-invalid={!!fe.message} aria-describedby={describedBy("c-message", null, fe.message)} />
      </Field>
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>{pending ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
