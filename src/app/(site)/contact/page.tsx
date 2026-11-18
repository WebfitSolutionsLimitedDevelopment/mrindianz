import type { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";
import { Section } from "@/components/ui/section";
import { PageHero } from "@/components/site/page-hero";
import { ContactForm } from "@/components/forms/contact-form";
import { getSettings } from "@/lib/content/repo";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the Mr. IndiaNZ 2027 team.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const [{ contact, event }, sp] = await Promise.all([getSettings(), searchParams]);
  const subject = typeof sp.subject === "string" ? sp.subject.slice(0, 150) : undefined;
  const socials = Object.entries(contact.socials).filter(([, v]) => !!v) as [string, string][];
  return (
    <>
      <PageHero eyebrow="Contact" title={<>We&apos;d love to <em className="text-gold-gradient">hear from you</em>.</>} intro="Questions about applying, partnerships, media or People's Choice? Send us a message." />
      <Section tone="ivory">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div className="space-y-5">
            <div className="card flex gap-4 p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-gold"><Mail className="h-5 w-5" aria-hidden /></span>
              <div><p className="eyebrow">Email</p><p className="mt-1 text-espresso">{contact.email ? <a className="underline decoration-gold-deep underline-offset-4" href={`mailto:${contact.email}`}>{contact.email}</a> : <span className="text-stone">Official address to be confirmed — please use the form.</span>}</p></div>
            </div>
            <div className="card flex gap-4 p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-gold"><MapPin className="h-5 w-5" aria-hidden /></span>
              <div><p className="eyebrow">Grand Finale</p><p className="mt-1 text-espresso">{event.venueName}, {event.venueAddress}</p></div>
            </div>
            {socials.length > 0 && (
              <div className="card p-6"><p className="eyebrow">Follow</p><div className="mt-3 flex flex-wrap gap-3">{socials.map(([k, v]) => <a key={k} className="rounded-full border border-espresso/15 px-4 py-1.5 text-xs uppercase tracking-[0.14em] text-espresso hover:border-gold-deep" href={v} target="_blank" rel="noopener noreferrer">{k}</a>)}</div></div>
            )}
          </div>
          <div className="card relative p-7 sm:p-10"><ContactForm defaultSubject={subject} /></div>
        </div>
      </Section>
    </>
  );
}
