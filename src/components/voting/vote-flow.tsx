"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { startVoteCheckout, type CheckoutResult } from "@/app/(site)/peoples-choice/actions";
import { Button } from "@/components/ui/button";
import { Field, describedBy, inputClasses } from "@/components/forms/field";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/cn";
import { voteCheckoutSchema } from "@/lib/validation/voting";

export interface VoteFlowPackage {
  id: string;
  name: string;
  label: string | null;
  priceCents: number;
  votes: number;
  maxQuantity: number;
  isDemoValue: boolean;
}

export interface VoteFlowContestant {
  id: string;
  name: string;
  number: number | null;
}

export interface VoteFlowProps {
  campaignId: string;
  contestants: VoteFlowContestant[];
  fixedContestantId?: string;
  packages: VoteFlowPackage[];
  maxQuantityPerOrder: number;
  paymentsReady: boolean;
  demoMode: boolean;
  priceNote: string | null;
}

type Step = "choose" | "details" | "review" | "done";

export function VoteFlow(props: VoteFlowProps) {
  const [step, setStep] = useState<Step>("choose");
  const [contestantId, setContestantId] = useState(props.fixedContestantId ?? "");
  const [packageId, setPackageId] = useState(props.packages[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();

  const pkg = props.packages.find((p) => p.id === packageId);
  const contestant = props.contestants.find((c) => c.id === contestantId);
  const maxQty = Math.min(pkg?.maxQuantity ?? 1, props.maxQuantityPerOrder);
  // Display-only estimate (integer arithmetic). The server recalculates from the database.
  const totalCents = (pkg?.priceCents ?? 0) * quantity;
  const totalVotes = (pkg?.votes ?? 0) * quantity;
  const canPay = props.paymentsReady || props.demoMode;

  const payload = useMemo(() => ({
    idempotencyKey, campaignId: props.campaignId, contestantId, packageId, quantity,
    supporterName: name, supporterEmail: email, displayAnonymously: anonymous, acceptTerms: terms,
  }), [idempotencyKey, props.campaignId, contestantId, packageId, quantity, name, email, anonymous, terms]);

  function validate(fields: string[]) {
    const r = voteCheckoutSchema.safeParse(payload);
    const e: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) { const k = i.path.join("."); if (fields.includes(k)) e[k] ??= i.message; }
    if (fields.includes("contestantId") && !contestantId) e.contestantId = "Choose a contestant";
    if (fields.includes("packageId") && !packageId) e.packageId = "Choose a voting package";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate(["contestantId", "packageId", "quantity", "supporterName", "supporterEmail", "acceptTerms"]) || !canPay) return;
    startTransition(async () => {
      const r = await startVoteCheckout(payload);
      setResult(r);
      if (r.status === "redirect") {
        window.location.assign(r.url);
      } else if (r.status === "demo_complete") {
        setStep("done");
      } else if (r.status === "error" && r.fieldErrors) {
        setErrors(r.fieldErrors);
      }
    });
  }

  function reset() {
    setStep("choose");
    setResult(null);
    setIdempotencyKey(crypto.randomUUID());
    setTerms(false);
  }

  if (props.packages.length === 0) {
    return <p className="text-mist">Voting packages will be announced soon.</p>;
  }

  if (step === "done" && result?.status === "demo_complete") {
    return (
      <div role="status" className="border border-gold p-6">
        <p className="eyebrow">Demo environment</p>
        <h3 className="mt-2 text-3xl">Demo votes recorded</h3>
        <p className="mt-2 text-mist">{result.votes} demo votes were added for {contestant?.name} (order {result.orderRef}). No payment was taken. Demo votes never appear on the live website.</p>
        <Button type="button" variant="secondary" className="mt-6" onClick={reset}>Vote again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ol className="flex gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]" aria-label="Voting steps">
        {(["choose", "details", "review"] as const).map((s, i) => (
          <li key={s} aria-current={step === s ? "step" : undefined} className={cn("flex-1 border-t-2 pt-2", step === s ? "border-gold text-gold" : "border-line text-mist")}>
            {i + 1}. {s === "choose" ? "Package" : s === "details" ? "Your details" : "Review"}
          </li>
        ))}
      </ol>

      {step === "choose" && (
        <div className="space-y-6">
          {!props.fixedContestantId && (
            <Field id="v-contestant" label="Contestant" required error={errors.contestantId}>
              <select id="v-contestant" value={contestantId} onChange={(e) => setContestantId(e.target.value)} className={inputClasses}
                aria-invalid={!!errors.contestantId} aria-describedby={describedBy("v-contestant", null, errors.contestantId)}>
                <option value="">Select a contestant</option>
                {props.contestants.map((c) => <option key={c.id} value={c.id}>{c.number !== null ? `${String(c.number).padStart(2, "0")} · ` : ""}{c.name}</option>)}
              </select>
            </Field>
          )}
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">Voting package <span className="text-gold" aria-hidden>*</span></legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {props.packages.map((p) => (
                <label key={p.id} className={cn("flex cursor-pointer flex-col border p-4 transition-colors", packageId === p.id ? "border-gold bg-gold/5" : "border-line hover:border-mist")}>
                  <input type="radio" name="package" value={p.id} checked={packageId === p.id} onChange={() => { setPackageId(p.id); setQuantity(1); }} className="sr-only" />
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-2xl">{p.name}</span>
                    <span className="font-semibold text-gold">{formatCents(p.priceCents)}</span>
                  </span>
                  <span className="mt-1 text-sm text-ivory">{p.votes.toLocaleString("en-NZ")} votes</span>
                  {p.isDemoValue && <span className="mt-2 text-[10px] uppercase tracking-[0.14em] text-mist">Demonstration value — not approved pricing</span>}
                </label>
              ))}
            </div>
            {errors.packageId && <p className="mt-2 text-sm text-danger" role="alert">{errors.packageId}</p>}
          </fieldset>
          <Field id="v-qty" label="Quantity" required hint={`Up to ${maxQty} per purchase.`} error={errors.quantity}>
            <input id="v-qty" type="number" min={1} max={maxQty} value={quantity} inputMode="numeric"
              onChange={(e) => setQuantity(Math.max(1, Math.min(maxQty, Math.floor(Number(e.target.value) || 1))))}
              className={cn(inputClasses, "max-w-32")} aria-describedby={describedBy("v-qty", true, errors.quantity)} />
          </Field>
          <Summary pkgName={pkg?.name} quantity={quantity} totalCents={totalCents} totalVotes={totalVotes} contestantName={contestant?.name} priceNote={props.priceNote} />
          <Button type="button" onClick={() => validate(["contestantId", "packageId", "quantity"]) && setStep("details")}>Continue</Button>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field id="v-name" label="Your name" required error={errors.supporterName}>
              <input id="v-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={inputClasses}
                aria-invalid={!!errors.supporterName} aria-describedby={describedBy("v-name", null, errors.supporterName)} />
            </Field>
            <Field id="v-email" label="Your email" required hint="For your receipt. Never shown publicly." error={errors.supporterEmail}>
              <input id="v-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" inputMode="email" className={inputClasses}
                aria-invalid={!!errors.supporterEmail} aria-describedby={describedBy("v-email", true, errors.supporterEmail)} />
            </Field>
          </div>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--color-gold)]" />
            <span className="text-sm">Show me as <strong>Anonymous</strong> in public supporter activity</span>
          </label>
          <div>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--color-gold)]"
                aria-invalid={!!errors.acceptTerms} aria-describedby={errors.acceptTerms ? "v-terms-err" : undefined} />
              <span className="text-sm">I accept the <Link href="/voting-rules" target="_blank" className="text-gold underline">People&apos;s Choice voting rules</Link> and understand votes are credited only after payment is verified. <span className="text-gold" aria-hidden>*</span></span>
            </label>
            {errors.acceptTerms && <p id="v-terms-err" className="mt-2 text-sm text-danger" role="alert">{errors.acceptTerms}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep("choose")}>Back</Button>
            <Button type="button" onClick={() => validate(["supporterName", "supporterEmail", "acceptTerms"]) && setStep("review")}>Review purchase</Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-6">
          <dl className="grid gap-4 border border-line p-5 sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-[0.14em] text-mist">Contestant</dt><dd className="mt-1 text-lg">{contestant?.name}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.14em] text-mist">Package</dt><dd className="mt-1 text-lg">{pkg?.name} × {quantity}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.14em] text-mist">Votes</dt><dd className="mt-1 text-lg">{totalVotes.toLocaleString("en-NZ")}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.14em] text-mist">Total</dt><dd className="mt-1 text-lg text-gold">{formatCents(totalCents)}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.14em] text-mist">Supporter</dt><dd className="mt-1">{anonymous ? "Anonymous (public)" : name}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.14em] text-mist">Receipt to</dt><dd className="mt-1 break-all">{email}</dd></div>
          </dl>
          {props.priceNote && <p className="text-sm text-mist">{props.priceNote}</p>}
          {result && result.status !== "redirect" && result.status !== "demo_complete" && (
            <p role="alert" className={cn("border p-4 text-sm", result.status === "payments_disabled" ? "border-gold text-gold" : "border-danger text-danger")}>{result.message}</p>
          )}
          {!canPay && (
            <p className="flex items-center gap-2 border border-gold/60 bg-gold/5 p-4 text-sm text-gold" role="note">
              <Lock className="h-4 w-4 shrink-0" aria-hidden /> Secure payments coming soon. Payment is not yet available and no votes will be recorded.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep("details")} disabled={pending}>Back</Button>
            <Button type="button" onClick={submit} disabled={!canPay || pending} aria-busy={pending}>
              {pending ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Processing…</> : props.demoMode ? "Record demo votes (no payment)" : canPay ? `Pay ${formatCents(totalCents)} securely` : "Secure payments coming soon"}
            </Button>
          </div>
          {props.paymentsReady && <p className="text-xs text-mist">You will be redirected to Stripe&apos;s secure checkout. Card details are never entered on this website.</p>}
        </div>
      )}
    </div>
  );
}

function Summary({ pkgName, quantity, totalCents, totalVotes, contestantName, priceNote }: {
  pkgName?: string; quantity: number; totalCents: number; totalVotes: number; contestantName?: string; priceNote: string | null;
}) {
  if (!pkgName) return null;
  return (
    <div className="border-l-2 border-gold bg-charcoal p-4 text-sm" aria-live="polite">
      <p><strong>{totalVotes.toLocaleString("en-NZ")} votes</strong>{contestantName ? ` for ${contestantName}` : ""} — {pkgName} × {quantity} = <strong className="text-gold">{formatCents(totalCents)}</strong></p>
      {priceNote && <p className="mt-1 text-mist">{priceNote}</p>}
    </div>
  );
}
