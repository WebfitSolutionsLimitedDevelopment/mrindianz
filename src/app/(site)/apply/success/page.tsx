import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/section";
import { PageHero } from "@/components/site/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { ApplicationReceipt } from "./receipt";
import { FEE_DISCLOSURE } from "@/lib/content/defaults";
import { getSettings } from "@/lib/content/repo";

export const metadata: Metadata = { title: "Application received", robots: { index: false, follow: false } };

export default async function ApplySuccessPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [{ ref }, settings] = await Promise.all([searchParams, getSettings()]);
  const reference = typeof ref === "string" && /^MINZ27-[A-F0-9]{8}$/.test(ref) ? ref : null;
  return (
    <>
    <PageHero eyebrow="Thank you" title={<>Application <em className="text-gold-gradient">received</em>.</>} />
    <Section tone="cream">
      <div className="card mx-auto max-w-3xl p-8 sm:p-12">
        <div role="status">
          {reference ? <ApplicationReceipt reference={reference} /> : <p className="text-stone">Your application has been received.</p>}
        </div>
        {reference && (
          <div className="mt-10 rounded-2xl bg-ink p-7 text-ivory">
            <h2 className="eyebrow eyebrow-dark font-sans">Receipt summary</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-[0.16em] text-mist">Application reference</dt><dd className="mt-1 font-mono text-xl text-gold">{reference}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.16em] text-mist">Application fee</dt><dd className="mt-1">Free — no payment taken</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.16em] text-mist">Rehearsals</dt><dd className="mt-1">{settings.event.rehearsalDisplay}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.16em] text-mist">Grand Finale</dt><dd className="mt-1">{settings.event.finaleDisplay}</dd></div>
            </dl>
            <p className="mt-6 text-sm text-mist">{FEE_DISCLOSURE}</p>
          </div>
        )}
        <p className="mt-8 text-sm text-stone">
          Questions? {settings.contact.email ? <a className="text-gold-ink underline" href={`mailto:${settings.contact.email}`}>{settings.contact.email}</a> : <Link className="text-gold-ink underline" href="/contact">Contact the team</Link>}
          {reference && <> and quote your reference {reference}.</>}
        </p>
        <div className="mt-10"><ButtonLink href="/" variant="outline">Back to home</ButtonLink></div>
      </div>
    </Section>
    </>
  );
}
