import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getSettings } from "@/lib/content/repo";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Tickets",
  description: "Tickets for the Mr. IndiaNZ 2027 Grand Finale at The Cloud, Auckland.",
  alternates: { canonical: "/tickets" },
};

export default async function TicketsPage() {
  const { event, tickets } = await getSettings();
  return (
    <>
      <Section tone="dark" className="border-b border-line">
        <SectionHeading as="h1" eyebrow="Tickets" title="Grand Finale tickets" />
        <dl className="grid gap-6 sm:grid-cols-2">
          <div><dt className="eyebrow">Date</dt><dd className="mt-2 font-display text-3xl">{event.finaleDisplay}</dd></div>
          <div><dt className="eyebrow">Venue</dt><dd className="mt-2 font-display text-3xl">{event.venueName}</dd><dd className="text-mist">{event.venueAddress}</dd></div>
        </dl>
      </Section>
      <Section tone="charcoal">
        {tickets.url ? (
          <div className="text-center">
            <h2 className="text-4xl">Tickets are on sale</h2>
            <p className="mt-3 text-mist">Tickets are sold by our ticketing partner. You will leave this website to complete your purchase.</p>
            <div className="mt-8"><ButtonLink href={tickets.url} size="lg" target="_blank" rel="noopener noreferrer">Buy tickets</ButtonLink></div>
          </div>
        ) : (
          <EmptyState title="Tickets Coming Soon">{tickets.note}</EmptyState>
        )}
      </Section>
    </>
  );
}
