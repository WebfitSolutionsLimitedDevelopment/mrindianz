import type { Metadata } from "next";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { Section } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHero } from "@/components/site/page-hero";
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
      <PageHero eyebrow="Grand Finale" title={<>An evening at <em className="text-gold-gradient">The Cloud</em>.</>} intro="Join us on Queens Wharf for the crowning of the first Mr. IndiaNZ." />
      <Section tone="ivory">
        <div className="mb-12 grid gap-5 sm:grid-cols-3">
          {[[CalendarDays, "Date", event.finaleDisplay], [MapPin, "Venue", `${event.venueName}, ${event.venueAddress}`], [Ticket, "Tickets", tickets.url ? "On sale now" : "Coming soon"]].map(([Icon, k, v]) => {
            const I = Icon as typeof Ticket;
            return (
              <div key={k as string} className="card flex gap-4 p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-gold"><I className="h-5 w-5" aria-hidden /></span>
                <div><p className="eyebrow">{k as string}</p><p className="mt-1 font-display text-lg text-espresso">{v as string}</p></div>
              </div>
            );
          })}
        </div>
        {tickets.url ? (
          <div className="card p-12 text-center">
            <h2 className="text-4xl text-espresso">Tickets are on sale</h2>
            <p className="mt-3 text-stone">Tickets are sold by our ticketing partner. You will leave this website to complete your purchase.</p>
            <div className="mt-8"><ButtonLink href={tickets.url} size="lg" target="_blank" rel="noopener noreferrer">Buy tickets</ButtonLink></div>
          </div>
        ) : (
          <EmptyState title="Tickets Coming Soon">{tickets.note}</EmptyState>
        )}
      </Section>
    </>
  );
}
