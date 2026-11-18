import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/ui/section";
import { ContactForm } from "@/components/forms/contact-form";
import { getSettings } from "@/lib/content/repo";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the Mr. IndiaNZ 2027 team.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const [{ contact }, sp] = await Promise.all([getSettings(), searchParams]);
  const subject = typeof sp.subject === "string" ? sp.subject.slice(0, 150) : undefined;
  const socials = Object.entries(contact.socials).filter(([, v]) => !!v) as [string, string][];
  return (
    <Section tone="dark">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <SectionHeading as="h1" eyebrow="Contact" title="Get in touch" intro="Questions about applying, partnerships, media or People's Choice? Send us a message." />
          <dl className="space-y-4 text-sm">
            <div><dt className="eyebrow">Email</dt><dd className="mt-1">{contact.email ? <a className="text-gold underline" href={`mailto:${contact.email}`}>{contact.email}</a> : <span className="text-mist">Official email address to be confirmed — please use the form.</span>}</dd></div>
            {socials.length > 0 && (
              <div><dt className="eyebrow">Social</dt><dd className="mt-1 flex flex-wrap gap-4">{socials.map(([k, v]) => <a key={k} className="capitalize text-gold underline" href={v} target="_blank" rel="noopener noreferrer">{k}</a>)}</dd></div>
            )}
          </dl>
        </div>
        <div className="relative"><ContactForm defaultSubject={subject} /></div>
      </div>
    </Section>
  );
}
