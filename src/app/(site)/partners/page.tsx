/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHero } from "@/components/site/page-hero";
import { getPartners } from "@/lib/content/repo";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Partners",
  description: "Sponsors and partners of Mr. IndiaNZ 2027, and partnership opportunities.",
  alternates: { canonical: "/partners" },
};

const CATEGORIES = [["presenting", "Presenting Partner"], ["major", "Major Partners"], ["supporting", "Supporting Partners"], ["media", "Media Partners"], ["community", "Community Partners"]] as const;

export default async function PartnersPage() {
  const partners = await getPartners();
  return (
    <>
      <PageHero eyebrow="Partners" title={<>Partner with <em className="text-gold-gradient">Mr. IndiaNZ</em>.</>}
        intro="A premium platform connecting your brand with Kiwi-Indian audiences — on stage at The Cloud and across our community. Only confirmed partners are shown on this page.">
        <ButtonLink href="/contact?subject=Partnership%20enquiry">Partnership enquiries</ButtonLink>
      </PageHero>
      <Section tone="ivory">
        {partners.length === 0 ? (
          <EmptyState title="Partner announcements coming soon" action={<ButtonLink href="/contact?subject=Partnership%20enquiry" variant="outline">Become a partner</ButtonLink>}>
            Presenting, major, supporting, media and community partnerships are available for the inaugural competition.
          </EmptyState>
        ) : (
          <div className="space-y-16">
            {CATEGORIES.map(([key, label]) => {
              const list = partners.filter((p) => p.category === key);
              if (!list.length) return null;
              return (
                <section key={key} aria-labelledby={`p-${key}`}>
                  <p className="eyebrow">Partners</p>
                  <h2 id={`p-${key}`} className="mb-8 mt-2 text-3xl text-espresso sm:text-4xl">{label}</h2>
                  <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((p) => (
                      <li key={p.id} className="card flex flex-col p-7">
                        <div className="flex h-24 items-center">{p.logoUrl ? <img src={p.logoUrl} alt={`${p.name} logo`} className="max-h-20 w-auto object-contain" loading="lazy" /> : <p className="font-display text-2xl text-espresso">{p.name}</p>}</div>
                        {p.logoUrl && <p className="mt-4 font-semibold text-espresso">{p.name}</p>}
                        {p.description && <p className="mt-2 text-sm text-stone">{p.description}</p>}
                        {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-auto pt-5 text-sm font-semibold text-gold-ink underline">Visit website<span className="sr-only"> of {p.name} (opens in a new tab)</span></a>}
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
