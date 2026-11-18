import Link from "next/link";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Prose, Section, SectionHeading } from "@/components/ui/section";
import { PendingApproval } from "@/components/ui/badge";
import { Countdown } from "@/components/site/countdown";
import { FaqList } from "@/components/site/faq-list";
import { ContestantCard } from "@/components/site/contestant-card";
import { JsonLd } from "@/components/site/json-ld";
import { getFaqs, getPartners, getSections, getSettings } from "@/lib/content/repo";
import { getPublishedContestants } from "@/lib/contestants/repo";
import { getActiveCampaign } from "@/lib/voting/repo";
import { effectiveVotingState } from "@/lib/voting/state";
import { getRegistrationState } from "@/lib/registration";
import { formatNzDate } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { FEE_DISCLOSURE } from "@/lib/content/defaults";

export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [settings, sections, comp, faqs, contestants, partners, campaign, reg] = await Promise.all([
    getSettings(), getSections("home"), getSections("competition"), getFaqs(), getPublishedContestants(), getPartners(),
    getActiveCampaign(), getRegistrationState(),
  ]);
  const { event } = settings;
  const votingState = campaign ? effectiveVotingState(campaign) : "draft";
  const rounds = comp.rounds?.content.items ?? [];
  const pillars = sections.pillars?.content.items ?? [];
  const journey = sections.journey?.content.items ?? [];
  const applyOpen = reg.state === "open";

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: event.shortDescription,
    startDate: event.finaleDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venueName,
      address: { "@type": "PostalAddress", streetAddress: "Queens Wharf, 89 Quay Street", addressLocality: "Auckland", addressCountry: "NZ" },
    },
    organizer: { "@type": "Organization", name: event.organiser, url: absoluteUrl("/") },
    image: [absoluteUrl("/brand/og-default.jpg")],
    url: absoluteUrl("/"),
  };

  return (
    <>
      <JsonLd data={eventJsonLd} />

      {/* Hero */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line bg-ink">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(242,178,51,0.10),transparent_55%)]" />
        <div className="container-x relative grid gap-12 py-20 sm:py-28 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:py-36">
          <div>
            <p className="eyebrow mb-6">The inaugural competition</p>
            <h1 id="hero-title" className="font-display text-[3.1rem] font-medium uppercase leading-[0.95] tracking-[0.02em] sm:text-7xl lg:text-8xl">
              Mr. IndiaNZ <span className="text-gold">2027</span>
            </h1>
            <p className="mt-6 max-w-xl font-display text-2xl italic text-ivory/90 sm:text-3xl">{event.tagline}</p>
            {!event.taglineApproved && <div className="mt-3"><PendingApproval label="Proposed tagline" /></div>}
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-ivory sm:text-base">
              {event.finaleDisplay} <span aria-hidden className="mx-2 text-gold">|</span> {event.venueShort}
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              {applyOpen ? (
                <ButtonLink href="/apply" size="lg">Apply Now</ButtonLink>
              ) : (
                <ButtonLink href="/competition#eligibility" size="lg">Applications opening soon</ButtonLink>
              )}
              <ButtonLink href="/competition" variant="secondary" size="lg">Discover the Competition</ButtonLink>
            </div>
          </div>
          <div className="space-y-8 lg:pb-3">
            {event.countdownEnabled && <Countdown date={event.finaleDate} label="the Grand Finale" />}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-6 text-sm">
              {[
                ["Grand Finale", event.finaleDisplay],
                ["Venue", event.venueShort],
                ["Rehearsals", "20–21 March 2027"],
                ["Application fee", event.applicationFeeDisplay],
                ["Selected-contestant fee", "NZD $350"],
                ["Organiser", event.organiser],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-mist">{k}</dt>
                  <dd className="mt-1 text-ivory">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* About */}
      {sections.about && (
        <Section tone="light" labelledBy="about-title">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <SectionHeading eyebrow="About" id="about-title" title={sections.about.content.title} />
            <div>
              <Prose text={sections.about.content.body} className="text-ink/85" />
              <Link href="/about" className="mt-6 inline-block text-sm font-semibold uppercase tracking-[0.16em] text-gold-ink underline-offset-4 hover:underline">More about Mr. IndiaNZ</Link>
            </div>
          </div>
        </Section>
      )}

      {/* Pillars */}
      <Section tone="dark" labelledBy="pillars-title">
        <SectionHeading eyebrow="The competition" id="pillars-title" title="Three pillars" intro="Indian cultural expression, contemporary fashion, personality, talent and stage presentation." />
        <ol className="grid gap-px bg-line md:grid-cols-3">
          {pillars.map((p, i) => (
            <li key={p.title} className="bg-ink p-8">
              <span className="font-display text-5xl text-gold">0{i + 1}</span>
              <h3 className="mt-4 text-3xl">{p.title}</h3>
              <p className="mt-3 text-mist">{p.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Why enter */}
      {sections.why_enter && (
        <Section tone="charcoal" labelledBy="why-title">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <SectionHeading eyebrow="Why enter" id="why-title" title={sections.why_enter.content.title} />
            <div>
              <Prose text={sections.why_enter.content.body} className="text-ivory/85" />
              <p className="mt-6 border-l-2 border-gold pl-4 text-sm text-mist">{FEE_DISCLOSURE}</p>
            </div>
          </div>
        </Section>
      )}

      {/* Rounds */}
      <Section tone="dark" labelledBy="rounds-title">
        <SectionHeading eyebrow="Format" id="rounds-title" title="Competition rounds" />
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {rounds.slice(0, 4).map((r) => (
            <li key={r.title} className="border-t-2 border-gold bg-charcoal p-6">
              <h3 className="text-2xl">{r.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mist">{r.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10"><ButtonLink href="/competition" variant="secondary">Rounds, eligibility &amp; judging</ButtonLink></div>
      </Section>

      {/* Key dates */}
      <Section tone="light" labelledBy="dates-title">
        <SectionHeading eyebrow="Key dates" id="dates-title" title="The road to the Grand Finale" />
        <ol className="relative border-l border-ink/20 pl-8">
          {settings.milestones.map((m) => (
            <li key={m.date + m.label} className="mb-8 last:mb-0">
              <span aria-hidden className="absolute -left-[5px] mt-2 h-2.5 w-2.5 rounded-full bg-gold-deep" />
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gold-ink">{formatNzDate(m.date)}</p>
              <p className="mt-1 font-display text-2xl">{m.label}</p>
              {!m.confirmed && <p className="mt-1 text-xs uppercase tracking-[0.14em] text-stone">Proposed — subject to confirmation</p>}
            </li>
          ))}
        </ol>
      </Section>

      {/* Journey */}
      {sections.journey && (
        <Section tone="dark" labelledBy="journey-title">
          <SectionHeading eyebrow="Application journey" id="journey-title" title={sections.journey.content.title} />
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {journey.map((s, i) => (
              <li key={s.title} className="flex gap-5 border border-line p-6">
                <span className="font-display text-4xl leading-none text-gold">{i + 1}</span>
                <div>
                  <h3 className="text-2xl">{s.title}</h3>
                  <p className="mt-2 text-sm text-mist">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          {applyOpen && <div className="mt-10"><ButtonLink href="/apply" size="lg">Start your free application</ButtonLink></div>}
        </Section>
      )}

      {/* Contestants preview */}
      <Section tone="charcoal" labelledBy="contestants-title">
        <SectionHeading eyebrow="Contestants" id="contestants-title" title={contestants.length ? "Meet the contestants" : "Contestants coming soon"}
          intro={contestants.length ? undefined : "Approved finalists will be announced here after selection."} />
        {contestants.length > 0 && (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {contestants.slice(0, 4).map((c) => <ContestantCard key={c.id} c={c} votingOpen={votingState === "open"} />)}
            </div>
            <div className="mt-10"><ButtonLink href="/contestants" variant="secondary">View all contestants</ButtonLink></div>
          </>
        )}
      </Section>

      {/* People's Choice preview */}
      {sections.peoples_choice && (
        <Section tone="dark" labelledBy="pc-title">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
            <SectionHeading eyebrow="People's Choice" id="pc-title" title={sections.peoples_choice.content.title} />
            <div>
              <Prose text={sections.peoples_choice.content.body} className="text-ivory/85" />
              <div className="mt-6"><ButtonLink href="/peoples-choice" variant="secondary">{votingState === "open" ? "Vote & Support" : "About People's Choice"}</ButtonLink></div>
            </div>
          </div>
        </Section>
      )}

      {/* Organiser */}
      {sections.organiser && (
        <Section tone="light" labelledBy="org-title">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
            <SectionHeading eyebrow="Organiser" id="org-title" title={sections.organiser.content.title} />
            <Prose text={sections.organiser.content.body} className="text-ink/85" />
          </div>
        </Section>
      )}

      {/* Partners */}
      <Section tone="charcoal" labelledBy="partners-title">
        <SectionHeading eyebrow="Partners" id="partners-title" title={partners.length ? "Our partners" : "Partner with Mr. IndiaNZ"}
          intro={partners.length ? undefined : "Partnership opportunities are available for the inaugural competition."} />
        {partners.length > 0 ? (
          <ul className="flex flex-wrap items-center gap-8">
            {partners.slice(0, 8).map((p) => <li key={p.id} className="text-lg text-ivory/90">{p.name}</li>)}
          </ul>
        ) : null}
        <div className="mt-8"><ButtonLink href="/partners" variant="secondary">Partnership enquiries</ButtonLink></div>
      </Section>

      {/* FAQs */}
      <Section tone="dark" labelledBy="faq-title">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading eyebrow="FAQ" id="faq-title" title="Questions, answered" />
          <div>
            <FaqList faqs={faqs.slice(0, 5)} />
            <Link href="/faq" className="mt-6 inline-block text-sm font-semibold uppercase tracking-[0.16em] text-gold hover:underline">All FAQs</Link>
          </div>
        </div>
      </Section>

      {/* Final CTA */}
      <section aria-labelledby="cta-title" className="border-t border-line bg-ink py-20 text-center sm:py-28">
        <div className="container-x">
          <div aria-hidden className="rule-gold mx-auto mb-10 w-40" />
          <h2 id="cta-title" className="mx-auto max-w-3xl text-4xl sm:text-6xl">Ready to represent Kiwi-Indian identity with confidence?</h2>
          <p className="mx-auto mt-6 max-w-xl text-mist">Applying is free. No prior modelling or pageant experience is required.</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            {applyOpen ? <ButtonLink href="/apply" size="lg">Apply Now</ButtonLink> : <ButtonLink href="/contact" size="lg">Register your interest</ButtonLink>}
            <ButtonLink href="/faq" variant="secondary" size="lg">Read the FAQ</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
