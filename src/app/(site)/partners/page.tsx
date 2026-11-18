/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { getPartners } from "@/lib/content/repo";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Partners",
  description: "Sponsors and partners of Mr. IndiaNZ 2027, and partnership opportunities.",
  alternates: { canonical: "/partners" },
};

const CATEGORIES = [
  ["presenting", "Presenting Partner"], ["major", "Major Partners"], ["supporting", "Supporting Partners"],
  ["media", "Media Partners"], ["community", "Community Partners"],
] as const;

export default async function PartnersPage() {
  const partners = await getPartners();
  return (
    <>
      <Section tone="dark" className="border-b border-line">
        <SectionHeading as="h1" eyebrow="Partners" title="Sponsors and partners"
          intro="Mr. IndiaNZ 2027 offers partners a premium platform connecting with Kiwi-Indian audiences. Only confirmed partners are shown on this page." />
        <ButtonLink href="/contact?subject=Partnership%20enquiry">Partnership enquiries</ButtonLink>
      </Section>
      <Section tone="light">
        {partners.length === 0 ? (
          <p className="text-center font-display text-3xl text-stone">Partner announcements coming soon.</p>
        ) : (
          <div className="space-y-16">
            {CATEGORIES.map(([key, label]) => {
              const list = partners.filter((p) => p.category === key);
              if (!list.length) return null;
              return (
                <section key={key} aria-labelledby={`p-${key}`}>
                  <h2 id={`p-${key}`} className="mb-6 text-3xl">{label}</h2>
                  <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((p) => (
                      <li key={p.id} className="flex flex-col border border-ink/15 bg-white/60 p-6">
                        {p.logoUrl ? <img src={p.logoUrl} alt={`${p.name} logo`} className="h-20 w-auto self-start object-contain" loading="lazy" /> : <p className="font-display text-2xl">{p.name}</p>}
                        {p.logoUrl && <p className="mt-4 font-semibold">{p.name}</p>}
                        {p.description && <p className="mt-2 text-sm text-stone">{p.description}</p>}
                        {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-4 text-sm font-semibold text-gold-ink underline">Visit website<span className="sr-only"> of {p.name} (opens in a new tab)</span></a>}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
