"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Check, ImageUp, Loader2, RefreshCw } from "lucide-react";
import type { z } from "zod";
import { CANONICAL_REGIONS } from "@/lib/content/defaults";
import {
  ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, STORY_MAX, applicantDetailsSchema, consentSchema, mediaSchema, personalStorySchema,
  type AgePolicy, type PhotoKind,
} from "@/lib/validation/registration";
import { submitApplication } from "@/app/(site)/apply/actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Field, describedBy, inputClasses } from "./field";

const STORAGE_KEY = "minz-apply-v1";
const STEPS = ["Your details", "Your story", "Photos & media", "Eligibility & consent"] as const;

interface PhotoState { path: string; name: string; previewUrl?: string }

interface FormState {
  clientSubmissionId: string;
  uploadSessionId: string;
  details: Record<string, string>;
  story: Record<string, string>;
  photos: Partial<Record<PhotoKind, PhotoState>>;
  videoUrl: string;
  consent: Record<string, boolean>;
}

function newState(): FormState {
  return {
    clientSubmissionId: crypto.randomUUID(),
    uploadSessionId: crypto.randomUUID(),
    details: {}, story: { talentAudition: "", hasExperience: "" }, photos: {}, videoUrl: "", consent: {},
  };
}

function issuesToErrors(error: z.ZodError, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = prefix + i.path.join(".");
    out[k] ??= i.message;
  }
  return out;
}

export interface ApplyFormProps {
  policy: AgePolicy;
  feeDisclosure: string;
  storyGuidance: string;
  photoGuidance: string;
  rehearsalDisplay: string;
  finaleDisplay: string;
}

export function ApplyForm(props: ApplyFormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState | null>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // Restore saved progress for this browser tab (sessionStorage: cleared when the tab closes).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as FormState & { step?: number };
        setState({ ...parsed, photos: Object.fromEntries(Object.entries(parsed.photos ?? {}).map(([k, v]) => [k, { path: v!.path, name: v!.name }])) });
        setStep(Math.min(parsed.step ?? 0, 3));
        return;
      }
    } catch {
      /* ignore corrupt state */
    }
    setState(newState());
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      const { photos, ...rest } = state;
      const slim = Object.fromEntries(Object.entries(photos).map(([k, v]) => [k, { path: v!.path, name: v!.name }]));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rest, photos: slim, step }));
    } catch {
      /* storage may be unavailable (private mode) — the form still works */
    }
  }, [state, step]);

  const update = useCallback(<K extends "details" | "story" | "consent">(group: K, key: string, value: FormState[K][string]) => {
    setState((s) => (s ? { ...s, [group]: { ...s[group], [key]: value } } : s));
    setErrors((e) => {
      const k = `${group}.${key}`;
      if (!e[k]) return e;
      const { [k]: _removed, ...rest } = e;
      void _removed;
      return rest;
    });
  }, []);

  const detailsSchema = useMemo(() => applicantDetailsSchema(props.policy), [props.policy]);

  function validateStep(i: number, s: FormState): Record<string, string> {
    if (i === 0) {
      const r = detailsSchema.safeParse(s.details);
      return r.success ? {} : issuesToErrors(r.error, "details.");
    }
    if (i === 1) {
      const r = personalStorySchema.safeParse({ ...s.story, talentAudition: s.story.talentAudition || undefined, hasExperience: s.story.hasExperience || undefined });
      return r.success ? {} : issuesToErrors(r.error, "story.");
    }
    if (i === 2) {
      const photos = Object.entries(s.photos).map(([kind, p]) => ({ kind, path: p!.path }));
      const r = mediaSchema.safeParse({ photos, videoUrl: s.videoUrl });
      return r.success ? {} : issuesToErrors(r.error, "media.");
    }
    const r = consentSchema.safeParse(s.consent);
    return r.success ? {} : issuesToErrors(r.error, "consent.");
  }

  function focusTop(hasErrors: boolean) {
    requestAnimationFrame(() => {
      (hasErrors ? errorSummaryRef.current : headingRef.current)?.focus();
    });
  }

  function next() {
    if (!state) return;
    const e = validateStep(step, state);
    setErrors(e);
    if (Object.keys(e).length) return focusTop(true);
    setStep((v) => Math.min(v + 1, 3));
    focusTop(false);
  }

  function back() {
    setErrors({});
    setStep((v) => Math.max(v - 1, 0));
    focusTop(false);
  }

  function submit() {
    if (!state || pending) return;
    for (let i = 0; i < 4; i++) {
      const e = validateStep(i, state);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(i);
        return focusTop(true);
      }
    }
    setSubmitError(null);
    startTransition(async () => {
      const payload = {
        clientSubmissionId: state.clientSubmissionId,
        uploadSessionId: state.uploadSessionId,
        details: state.details,
        story: { ...state.story, talentAudition: state.story.talentAudition || undefined, hasExperience: state.story.hasExperience || undefined },
        media: { photos: Object.entries(state.photos).map(([kind, p]) => ({ kind, path: p!.path })), videoUrl: state.videoUrl },
        consent: state.consent,
      };
      try {
        const res = await submitApplication(payload);
        if (res.ok) {
          try {
            sessionStorage.removeItem(STORAGE_KEY);
            sessionStorage.setItem("minz-apply-receipt", JSON.stringify({ reference: res.reference, email: state.details.email, emailStatus: res.emailStatus }));
          } catch { /* ignore */ }
          router.push(`/apply/success?ref=${encodeURIComponent(res.reference)}`);
          return;
        }
        setSubmitError(res.error);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          const first = Object.keys(res.fieldErrors)[0] ?? "";
          const target = first.startsWith("details") ? 0 : first.startsWith("story") ? 1 : first.startsWith("media") ? 2 : 3;
          setStep(target);
        }
        focusTop(true);
      } catch {
        setSubmitError("Your connection was interrupted. Your answers are saved — please try submitting again.");
        focusTop(true);
      }
    });
  }

  if (!state) {
    return <div className="flex items-center gap-3 text-stone"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading application form…</div>;
  }

  const errorList = Object.entries(errors);

  return (
    <div>
      {/* Progress */}
      <nav aria-label="Application progress" className="mb-10">
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? "step" : undefined}>
              <div className={cn("h-1", i <= step ? "bg-gold" : "bg-espresso/10")} />
              <p className={cn("mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] sm:text-xs", i === step ? "text-gold-ink" : "text-stone")}>
                <span className="sr-only">Step {i + 1} of 4: </span>
                <span aria-hidden>{i + 1}. </span><span className={cn(i === step ? "" : "hidden sm:inline")}>{label}</span>
                {i < step && <span className="sr-only"> (completed)</span>}
              </p>
            </li>
          ))}
        </ol>
      </nav>

      <h2 ref={headingRef} tabIndex={-1} className="mb-2 text-3xl outline-none sm:text-4xl">Step {step + 1}: {STEPS[step]}</h2>
      <p className="mb-8 text-sm text-stone">Fields marked <span className="text-gold-ink">*</span> are required. Your progress is saved in this browser tab.</p>

      {(errorList.length > 0 || submitError) && (
        <div ref={errorSummaryRef} tabIndex={-1} role="alert" className="mb-8 border border-danger-ink/60 bg-danger/5 p-5 outline-none">
          <p className="font-semibold text-danger-ink">{submitError ?? "Please fix the following:"}</p>
          {errorList.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-danger-ink">
              {errorList.map(([k, m]) => <li key={k}>{m}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-7">
        {step === 0 && <DetailsStep state={state} errors={errors} update={update} />}
        {step === 1 && <StoryStep state={state} errors={errors} update={update} guidance={props.storyGuidance} />}
        {step === 2 && (
          <MediaStep
            state={state}
            errors={errors}
            guidance={props.photoGuidance}
            setPhoto={(kind, p) => {
              setState((s) => (s ? { ...s, photos: { ...s.photos, [kind]: p ?? undefined } } : s));
              setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("media"))));
            }}
            setVideo={(v) => setState((s) => (s ? { ...s, videoUrl: v } : s))}
          />
        )}
        {step === 3 && <ConsentStep state={state} errors={errors} update={update} {...props} />}
      </div>

      <div className="mt-12 flex flex-col-reverse gap-4 border-t border-espresso/15 pt-8 sm:flex-row sm:justify-between">
        {step > 0 ? <Button type="button" variant="secondary" onClick={back} disabled={pending}>Previous</Button> : <span />}
        {step < 3 ? (
          <Button type="button" onClick={next}>Next</Button>
        ) : (
          <Button type="button" size="lg" onClick={submit} disabled={pending} aria-busy={pending}>
            {pending ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Submitting…</> : "Submit Free Application"}
          </Button>
        )}
      </div>
    </div>
  );
}

type UpdateFn = <K extends "details" | "story" | "consent">(group: K, key: string, value: FormState[K][string]) => void;

function TextInput({ group, name, label, required, state, errors, update, type = "text", autoComplete, inputMode, hint, maxLength }: {
  group: "details" | "story"; name: string; label: string; required?: boolean; state: FormState; errors: Record<string, string>;
  update: UpdateFn; type?: string; autoComplete?: string; inputMode?: "email" | "tel" | "text" | "url"; hint?: string; maxLength?: number;
}) {
  const id = `${group}-${name}`;
  const err = errors[`${group}.${name}`];
  return (
    <Field id={id} label={label} required={required} hint={hint} error={err}>
      <input
        id={id} name={name} type={type} required={required} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength}
        value={(state[group][name] as string) ?? ""} onChange={(e) => update(group, name, e.target.value)}
        aria-invalid={!!err} aria-describedby={describedBy(id, hint, err)} className={inputClasses}
      />
    </Field>
  );
}

function DetailsStep({ state, errors, update }: { state: FormState; errors: Record<string, string>; update: UpdateFn }) {
  const p = { state, errors, update, group: "details" as const };
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput {...p} name="legalName" label="Full legal name" required autoComplete="name" maxLength={120} />
        <TextInput {...p} name="stageName" label="Preferred public / stage name" autoComplete="nickname" maxLength={80} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput {...p} name="dateOfBirth" label="Date of birth" required type="date" autoComplete="bday" />
        <TextInput {...p} name="occupation" label="Occupation / current field of study" maxLength={120} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput {...p} name="email" label="Email address" required type="email" autoComplete="email" inputMode="email" hint="We'll send your confirmation here." maxLength={254} />
        <TextInput {...p} name="mobile" label="Mobile number" required type="tel" autoComplete="tel" inputMode="tel" hint="e.g. 021 123 4567 or +64 21 123 4567" maxLength={20} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput {...p} name="city" label="City or town of residence" required autoComplete="address-level2" maxLength={80} />
        <Field id="details-region" label="Region" required error={errors["details.region"]}>
          <select
            id="details-region" value={state.details.region ?? ""} onChange={(e) => update("details", "region", e.target.value)} required
            aria-invalid={!!errors["details.region"]} aria-describedby={describedBy("details-region", null, errors["details.region"])} className={inputClasses}
          >
            <option value="">Select region</option>
            {CANONICAL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </div>
      <TextInput {...p} name="instagram" label="Instagram profile URL / handle" hint="e.g. @yourname" maxLength={200} />
    </>
  );
}

function TextArea({ name, label, required, state, errors, update, hint }: {
  name: string; label: string; required?: boolean; state: FormState; errors: Record<string, string>; update: UpdateFn; hint?: string;
}) {
  const id = `story-${name}`;
  const err = errors[`story.${name}`];
  const value = state.story[name] ?? "";
  return (
    <Field id={id} label={label} required={required} hint={hint} error={err}>
      <textarea
        id={id} rows={6} maxLength={STORY_MAX} value={value} onChange={(e) => update("story", name, e.target.value)} required={required}
        aria-invalid={!!err} aria-describedby={[describedBy(id, hint, err), `${id}-count`].filter(Boolean).join(" ")} className={inputClasses}
      />
      <p id={`${id}-count`} className="text-right text-xs text-stone" aria-live="polite">{value.length} / {STORY_MAX}</p>
    </Field>
  );
}

function YesNo({ name, legend, required, state, errors, update }: { name: string; legend: string; required?: boolean; state: FormState; errors: Record<string, string>; update: UpdateFn }) {
  const err = errors[`story.${name}`];
  const id = useId();
  return (
    <fieldset aria-describedby={err ? `${id}-err` : undefined}>
      <legend className="mb-3 text-sm font-semibold">{legend} {required ? <span className="text-gold-ink" aria-hidden>*</span> : <span className="font-normal text-stone">(optional)</span>}</legend>
      <div className="flex gap-3">
        {["yes", "no"].map((v) => (
          <label key={v} className={cn("flex min-h-11 cursor-pointer items-center gap-3 border px-5 py-2", state.story[name] === v ? "border-gold-deep text-gold-ink" : "border-espresso/15")}>
            <input type="radio" name={name} value={v} checked={state.story[name] === v} onChange={() => update("story", name, v)} className="h-4 w-4 accent-[var(--color-gold-deep)]" required={required} />
            {v === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </div>
      {err && <p id={`${id}-err`} className="mt-2 text-sm text-danger-ink" role="alert">{err}</p>}
    </fieldset>
  );
}

function StoryStep({ state, errors, update, guidance }: { state: FormState; errors: Record<string, string>; update: UpdateFn; guidance: string }) {
  const p = { state, errors, update };
  return (
    <>
      <p className="border-l-2 border-gold-deep pl-4 text-espresso/90">{guidance}</p>
      <TextArea {...p} name="whyEnter" label="Why do you want to enter Mr. IndiaNZ 2027?" required />
      <TextArea {...p} name="kiwiIndianMeaning" label="What does being Kiwi-Indian mean to you?" required />
      <TextArea {...p} name="interests" label="Tell us about your interests, achievements or community work" />
      <YesNo {...p} name="hasExperience" legend="Do you have previous stage, fashion or public speaking experience? (Experience is not required.)" />
      {state.story.hasExperience === "yes" && <TextArea {...p} name="experienceDetails" label="Tell us about your experience" />}
      <YesNo {...p} name="talentAudition" legend="Would you like to audition for Mr. Talent?" required />
      {state.story.talentAudition === "yes" && <TextArea {...p} name="talentDescription" label="Describe your talent and any equipment required" required />}
    </>
  );
}

function MediaStep({ state, errors, guidance, setPhoto, setVideo }: {
  state: FormState; errors: Record<string, string>; guidance: string;
  setPhoto: (kind: PhotoKind, p: PhotoState | null) => void; setVideo: (v: string) => void;
}) {
  const videoErr = errors["media.videoUrl"];
  return (
    <>
      <p className="border-l-2 border-gold-deep pl-4 text-espresso/90">{guidance}</p>
      {errors["media.photos"] && <p className="text-sm text-danger-ink" role="alert">{errors["media.photos"]}</p>}
      <div className="grid gap-6 md:grid-cols-3">
        <PhotoUpload kind="headshot" label="Recent clear headshot" required state={state} error={errors["media.headshot"]} onChange={setPhoto} />
        <PhotoUpload kind="full_length" label="Recent full-length photograph" required state={state} error={errors["media.full_length"]} onChange={setPhoto} />
        <PhotoUpload kind="traditional" label="Traditional / Indian outfit photograph" state={state} error={errors["media.traditional"]} onChange={setPhoto} />
      </div>
      <Field id="media-video" label="Introduction video link (up to 90 seconds)" hint="YouTube (unlisted), Vimeo or a cloud link starting with https://" error={videoErr}>
        <input id="media-video" type="url" inputMode="url" value={state.videoUrl} onChange={(e) => setVideo(e.target.value)} maxLength={500}
          aria-invalid={!!videoErr} aria-describedby={describedBy("media-video", true, videoErr)} className={inputClasses} placeholder="https://" />
      </Field>
    </>
  );
}

function PhotoUpload({ kind, label, required, state, error, onChange }: {
  kind: PhotoKind; label: string; required?: boolean; state: FormState; error?: string; onChange: (kind: PhotoKind, p: PhotoState | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const current = state.photos[kind];
  const id = `photo-${kind}`;

  async function upload(file: File) {
    setLastFile(file);
    setMessage(null);
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setStatus("error");
      setMessage("Please choose a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus("error");
      setMessage(`This photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum is 5 MB.`);
      return;
    }
    setStatus("uploading");
    try {
      const res = await fetch("/api/apply/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, contentType: file.type, size: file.size, uploadSessionId: state.uploadSessionId }),
      });
      const body = (await res.json().catch(() => ({}))) as { path?: string; token?: string; error?: string };
      if (!res.ok || !body.path || !body.token) throw new Error(body.error ?? "Upload could not start.");
      const supabase = createBrowserSupabase();
      if (!supabase) throw new Error("Uploads are not available yet.");
      const { error: upErr } = await supabase.storage.from("mrindianz-applications").uploadToSignedUrl(body.path, body.token, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error("Upload failed. Please check your connection and retry.");
      onChange(kind, { path: body.path, name: file.name, previewUrl: URL.createObjectURL(file) });
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Upload failed. Please retry.");
    }
  }

  const err = message ?? error;
  return (
    <div className="flex flex-col">
      <p id={`${id}-label`} className="mb-2 text-sm font-semibold">
        {label} {required ? <span className="text-gold-ink" aria-hidden>*</span> : <span className="font-normal text-stone">(optional)</span>}
        {required && <span className="sr-only"> (required)</span>}
      </p>
      <div className={cn("relative flex aspect-[4/5] items-center justify-center overflow-hidden border border-dashed bg-ivory-2", err ? "border-danger-ink" : current ? "border-gold-deep" : "border-espresso/15")}>
        {current?.previewUrl ? (
          <img src={current.previewUrl} alt={`Preview of your ${label.toLowerCase()}`} className="h-full w-full object-cover" />
        ) : current ? (
          <div className="p-4 text-center text-sm text-espresso"><Check className="mx-auto mb-2 h-8 w-8 text-gold-ink" aria-hidden />Uploaded<br /><span className="break-all text-stone">{current.name}</span></div>
        ) : status === "uploading" ? (
          <div className="text-center text-sm text-stone"><Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" aria-hidden />Uploading…</div>
        ) : (
          <div className="p-4 text-center text-sm text-stone"><ImageUp className="mx-auto mb-2 h-8 w-8" aria-hidden />JPG, PNG or WEBP<br />max 5 MB</div>
        )}
      </div>
      <input
        ref={inputRef} id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
        aria-labelledby={`${id}-label`} aria-describedby={err ? `${id}-err` : undefined} aria-invalid={!!err}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={status === "uploading"} onClick={() => inputRef.current?.click()}>
          {current ? "Replace" : "Choose photo"}<span className="sr-only"> for {label}</span>
        </Button>
        {status === "error" && lastFile && (
          <Button type="button" variant="ghost" size="sm" onClick={() => void upload(lastFile)}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Retry
          </Button>
        )}
        {current && !required && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(kind, null)}>Remove</Button>
        )}
      </div>
      <p aria-live="polite" className="sr-only">{status === "uploading" ? `Uploading ${label}` : current ? `${label} uploaded` : ""}</p>
      {err && <p id={`${id}-err`} role="alert" className="mt-2 text-sm text-danger-ink">{err}</p>}
    </div>
  );
}

function ConsentStep({ state, errors, update, feeDisclosure, rehearsalDisplay, finaleDisplay }: {
  state: FormState; errors: Record<string, string>; update: UpdateFn; feeDisclosure: string; rehearsalDisplay: string; finaleDisplay: string;
}) {
  const items: { key: string; label: React.ReactNode; required: boolean }[] = [
    { key: "rehearsalAvailability", required: true, label: <>I can attend the compulsory rehearsal weekend, {rehearsalDisplay}.</> },
    { key: "finaleAvailability", required: true, label: <>I can attend the Grand Finale, {finaleDisplay}.</> },
    { key: "feeUnderstanding", required: true, label: <>I understand applying is free and NZD $350 is payable only if selected and accepted.</> },
    { key: "eligibility", required: true, label: <>I meet the published age, residency, identity and heritage criteria (see <Link href="/competition#eligibility" target="_blank" className="text-gold-ink underline">eligibility</Link>).</> },
    { key: "accuracy", required: true, label: <>I confirm the information and photographs supplied are mine to submit and accurate.</> },
    { key: "terms", required: true, label: <>I have read the contestant eligibility, <Link href="/contestant-terms" target="_blank" className="text-gold-ink underline">terms and selection information</Link>.</> },
    { key: "privacy", required: true, label: <>I acknowledge the <Link href="/privacy" target="_blank" className="text-gold-ink underline">privacy notice</Link> and understand how application data is used.</> },
    { key: "marketing", required: false, label: <>Send me unrelated marketing, event news and announcements.</> },
  ];
  return (
    <>
      <p className="border border-gold-deep/50 bg-ivory-2 p-5 text-sm leading-relaxed text-espresso/90">{feeDisclosure}</p>
      <fieldset className="space-y-3">
        <legend className="sr-only">Availability, eligibility and consent</legend>
        {items.map((it) => {
          const err = errors[`consent.${it.key}`];
          const id = `consent-${it.key}`;
          return (
            <div key={it.key}>
              <label htmlFor={id} className={cn("flex cursor-pointer gap-4 border p-4", err ? "border-danger-ink" : state.consent[it.key] ? "border-gold-deep/70" : "border-espresso/15")}>
                <input
                  id={id} type="checkbox" checked={!!state.consent[it.key]} onChange={(e) => update("consent", it.key, e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-gold-deep)]" aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} required={it.required}
                />
                <span className="text-sm leading-relaxed">
                  {it.label} {it.required ? <span className="text-gold-ink" aria-hidden>*</span> : <span className="text-stone">(optional)</span>}
                </span>
              </label>
              {err && <p id={`${id}-err`} role="alert" className="mt-1 text-sm text-danger-ink">{err}</p>}
            </div>
          );
        })}
      </fieldset>
    </>
  );
}
