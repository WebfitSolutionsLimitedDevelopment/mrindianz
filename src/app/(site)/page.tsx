/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Crown, Mic2, Shirt, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Prose, Section, SectionHeading } from "@/components/ui/section";
import { PendingApproval } from "@/components/ui/badge";
import { Countdown } from "@/components/site/countdown";
import { FaqList } from "@/components/site/faq-list";
import { ContestantCard } from "@/components/site/contestant-card";
import { JsonLd } from "@/components/site/json-ld";
import { KoruMark, StageBackdrop } from "@/components/site/stage";
import { getFaqs, getPartners, getSections, getSettings } from "@/lib/content/repo";
import { getPublishedContestants } from "@/lib/contestants/repo";
import { getActiveCampaign } from "@/lib/voting/repo";
import { effectiveVotingState } from "@/lib/voting/state";
import { getRegistrationState } from "@/lib/registration";
import { formatNzDate } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { FEE_DISCLOSURE } from "@/lib/content/defaults";

export const revalidate = 60;
export const metadata: Metadata = { alternates: { canonical: "/" } };

const PILLAR_ICONS = [Sparkles, Shirt, Mic2];

export default async function HomePage() {
  const [settings, sections, comp, faqs, contestants, partners, campaign, reg] = await Promise.all([
    getSettings(), getSections("home"), getSections("competition"), getFaqs(), getPublishedContestants(), getPartners(),
    getActiveCampaign(), getRegistrationState(),
  ]);
  const { event, media } = settings;
  const votingState = campaign ? effectiveVotingState(campaign) : "draft";
  const rounds = comp.rounds?.content.items ?? [];
  const pillars = sections.pillars?.content.items ?? [];
  const journey = sections.journey?.content.items ?? [];
  const applyOpen = reg.state === "open";
  const [year] = event.name.match(/\d{4}/) ?? ["2027"];

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: event.shortDescription,
    startDate: event.finaleDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: event.venueName, address: { "@type": "PostalAddress", streetAddress: "Queens Wharf, 89 Quay Street", addressLocality: "Auckland", addressCountry: "NZ" } },
    organizer: { "@type": "Organization", name: event.organiser, url: absoluteUrl("/") },
    image: [absoluteUrl("/brand/og-default.jpg")],
    url: absoluteUrl("/"),
  };

  return (
    <>
      <JsonLd data={eventJsonLd} />

      {/* ───────────── HERO ───────────── */}
      <section aria-labelledby="hero-title" className="on-dark relative isolate flex min-h-[100svh] items-center overflow-hidden bg-ink text-ivory">
        <StageBackdrop image={media.heroImage} video={media.heroVideo} />
        <KoruMark className="absolute left-1/2 top-[54%] w-[min(92vw,62rem)] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" />
        <div className="container-x relative pb-24 pt-32 text-center sm:pt-36">
          <p className="eyebrow eyebrow-dark animate-rise">Culture&nbsp;·&nbsp;Style&nbsp;·&nbsp;Charisma</p>
          <h1 id="hero-title" className="mt-7 animate-rise font-display text-[3.4rem] font-semibold leading-[0.92] tracking-[-0.02em] text-white [animation-delay:100ms] sm:text-8xl lg:text-[9.5rem]">
            Mr. India<span className="text-gold-gradient">NZ</span>
          </h1>
          <p className="mt-3 animate-rise font-display text-3xl italic text-gold-bright [animation-delay:160ms] sm:text-5xl">{year}</p>
          <p className="mx-auto mt-8 max-w-2xl animate-rise font-display text-xl leading-snug text-white/90 [animation-delay:220ms] sm:text-2xl">{event.tagline}</p>
          {!event.taglineApproved && <div className="mt-4 animate-rise [animation-delay:240ms]"><PendingApproval dark label="Proposed tagline" /></div>}
          <div className="mx-auto mt-10 flex max-w-xl animate-rise flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/85 [animation-delay:300ms] sm:text-xs">
            <span className="hidden h-px flex-1 bg-gradient-to-r from-transparent to-gold/70 sm:block" />
            <span>{event.finaleDisplay.replace(/^Saturday /, "Sat ")}</span>
            <span className="text-gold" aria-hidden>◆</span>
            <span>{event.venueShort}</span>
            <span className="hidden h-px flex-1 bg-gradient-to-l from-transparent to-gold/70 sm:block" />
          </div>
          <div className="mt-11 flex animate-rise flex-col items-center justify-center gap-4 [animation-delay:380ms] sm:flex-row">
            {applyOpen ? (
              <ButtonLink href="/apply" size="lg">Apply Now — It&apos;s Free</ButtonLink>
            ) : (
              <ButtonLink href="/competition#eligibility" size="lg">Applications Opening Soon</ButtonLink>
            )}
            <ButtonLink href="/competition" variant="secondary" size="lg">Discover the Competition</ButtonLink>
          </div>
          {event.countdownEnabled && <div className="mt-14 animate-rise [animation-delay:460ms]"><Countdown date={event.finaleDate} label="the Grand Finale" /></div>}
        </div>
        <a href="#about" className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/60 hover:text-gold sm:flex">
          Scroll <span className="h-10 w-px bg-gradient-to-b from-gold to-transparent" aria-hidden />
        </a>
      </section>

      {/* ───────────── MARQUEE ───────────── */}
      <div className="relative overflow-hidden border-y border-gold/25 bg-onyx py-4" aria-hidden>
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display text-lg italic text-gold/90 sm:text-xl">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex gap-10">
              {["Culture & Heritage", "Fashion & Personal Style", "Confidence & Charisma", "The Cloud · Auckland", "Grand Finale · 3 April 2027", "Kiwi-Indian Pride"].map((t) => (
                <span key={t + k} className="flex items-center gap-10">{t}<span className="not-italic text-gold/40">✦</span></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ───────────── ABOUT ───────────── */}
      <Section tone="ivory" id="about" labelledBy="about-title">
        <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <SectionHeading eyebrow="The inaugural competition" id="about-title" title={<>A new national stage for <em className="text-gold-ink">Kiwi-Indian</em> men.</>} className="mb-8" />
            {sections.about && <Prose text={sections.about.content.body} className="text-stone first-letter:float-left first-letter:mr-3 first-letter:font-display first-letter:text-7xl first-letter:leading-[0.8] first-letter:text-gold-deep" />}
            <div className="mt-9 flex flex-wrap gap-4">
              <ButtonLink href="/about" variant="outline">Our story</ButtonLink>
              {applyOpen && <ButtonLink href="/apply">Apply now</ButtonLink>}
            </div>
          </div>
          <aside aria-label="Quick facts" className="on-dark relative overflow-hidden rounded-[1.75rem] bg-ink p-8 text-ivory shadow-[0_30px_60px_-30px_rgba(10,9,8,.7)] sm:p-10">
            <KoruMark className="absolute -right-16 -top-8 w-72 opacity-[0.12]" />
            <Crown aria-hidden className="relative h-8 w-8 text-gold" strokeWidth={1.4} />
            <p className="eyebrow eyebrow-dark relative mt-6">Quick facts</p>
            <dl className="relative mt-6 divide-y divide-white/10">
              {[
                ["Grand Finale", event.finaleDisplay],
                ["Venue", `${event.venueName}, Queens Wharf`],
                ["Rehearsals", "20–21 March 2027"],
                ["Application fee", event.applicationFeeDisplay],
                ["If selected", "NZD $350 participation fee"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-6 py-4">
                  <dt className="text-[11px] uppercase tracking-[0.2em] text-mist">{k}</dt>
                  <dd className="text-right font-display text-lg text-white">{v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </Section>

      {/* ───────────── PILLARS ───────────── */}
      <Section tone="cream" labelledBy="pillars-title">
        <SectionHeading align="center" eyebrow="What we celebrate" id="pillars-title" title="Three pillars" intro="Indian cultural expression, contemporary fashion, personality, talent and stage presentation." />
        <ol className="grid gap-6 md:grid-cols-3">
          {pillars.map((p, i) => {
            const Icon = PILLAR_ICONS[i] ?? Sparkles;
            return (
              <li key={p.title} className="card group relative overflow-hidden p-9 transition duration-500 hover:-translate-y-1.5">
                <span className="absolute right-6 top-4 font-display text-7xl text-gold/15 transition group-hover:text-gold/30" aria-hidden>0{i + 1}</span>
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-ink text-gold"><Icon aria-hidden className="h-6 w-6" strokeWidth={1.5} /></span>
                <h3 className="mt-7 text-3xl text-espresso">{p.title}</h3>
                <p className="mt-3 leading-relaxed text-stone">{p.body}</p>
                <span className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-gold-deep to-gold-bright transition-transform duration-500 group-hover:scale-x-100" aria-hidden />
              </li>
            );
          })}
        </ol>
      </Section>

      {/* ───────────── ROUNDS (programme) ───────────── */}
      <Section tone="dark" labelledBy="rounds-title" className="overflow-hidden" backdrop={<StageBackdrop intensity="soft" className="opacity-70" />}>
        <div className="relative grid gap-14 lg:grid-cols-[1fr_1.5fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeading dark eyebrow="Competition format" id="rounds-title" title={<>The programme of the <em className="text-gold-gradient">night</em>.</>} intro="Three rounds, one optional talent award, and a Grand Finale at The Cloud." />
            <ButtonLink href="/competition" variant="secondary">Rounds, eligibility &amp; judging</ButtonLink>
          </div>
          <ol className="divide-y divide-white/10 border-y border-white/10">
            {rounds.map((r, i) => {
              const [label, name] = r.title.includes(":") ? r.title.split(/:\s*/) : [`Round ${i + 1}`, r.title];
              const separate = /talent/i.test(r.title);
              return (
                <li key={r.title} className="group grid grid-cols-[4.5rem_1fr] gap-6 py-8 sm:grid-cols-[6rem_1fr]">
                  <span className="font-display text-5xl leading-none text-gold/40 transition group-hover:text-gold sm:text-6xl">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-gold">{label}</p>
                    <h3 className="mt-1 text-3xl text-white sm:text-4xl">{name}</h3>
                    <p className="mt-3 max-w-xl leading-relaxed text-mist">{r.body}</p>
                    {separate && <p className="mt-3"><span className="rounded-full border border-gold/40 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-gold">Separate award</span></p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Section>

      {/* ───────────── WHY ENTER ───────────── */}
      {sections.why_enter && (
        <Section tone="ivory" labelledBy="why-title">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <SectionHeading eyebrow="Why enter" id="why-title" title={<>Your story deserves a <em className="text-gold-ink">stage</em>.</>} />
            <div>
              <Prose text={sections.why_enter.content.body} className="text-stone" />
              <div className="mt-8 rounded-2xl border border-gold/30 bg-gold/5 p-6 text-sm leading-relaxed text-espresso">
                <p className="eyebrow mb-2">Transparent fees</p>
                {FEE_DISCLOSURE}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ───────────── LEGACY (organiser's photography) ───────────── */}
      {media.legacy.length > 0 && (
        <Section tone="cream" labelledBy="legacy-title">
          <SectionHeading eyebrow="From the team behind Miss India South Pacific" id="legacy-title" title="A stage built by people who know pageantry." intro={sections.organiser?.content.body} />
          <div className="grid auto-rows-[11rem] grid-cols-2 gap-4 sm:auto-rows-[14rem] md:grid-cols-4">
            {media.legacy.slice(0, 5).map((m, i) => (
              <figure key={m.src} className={i === 0 ? "group relative col-span-2 row-span-2 overflow-hidden rounded-2xl" : "group relative overflow-hidden rounded-2xl"}>
                <img src={m.src} alt={m.alt} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-3 pt-10 text-xs uppercase tracking-[0.18em] text-white/90">{m.caption}</figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-5 text-xs text-stone">Photography: Miss India South Pacific 2026 Grand Finale, produced by {event.organiser}.</p>
        </Section>
      )}

      {/* ───────────── JOURNEY ───────────── */}
      {journey.length > 0 && (
        <Section tone="ivory" labelledBy="journey-title">
          <SectionHeading align="center" eyebrow="Application journey" id="journey-title" title="From application to the crown." />
          <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {journey.map((s, i) => (
              <li key={s.title} className="card relative p-8">
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-deep/40 font-display text-lg text-gold-ink">{i + 1}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-gold/50 to-transparent" aria-hidden />
                </div>
                <h3 className="mt-6 text-2xl text-espresso">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-stone">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 text-center">
            {applyOpen ? <ButtonLink href="/apply" size="lg">Start your free application</ButtonLink> : <ButtonLink href="/competition" variant="outline" size="lg">Read the full competition guide</ButtonLink>}
          </div>
        </Section>
      )}

      {/* ───────────── KEY DATES ───────────── */}
      <Section tone="dark" labelledBy="dates-title">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <SectionHeading dark eyebrow="Key dates" id="dates-title" title={<>The road to <em className="text-gold-gradient">3 April</em>.</>} />
            {event.countdownEnabled && <Countdown date={event.finaleDate} label="the Grand Finale" />}
          </div>
          <ol className="space-y-3">
            {settings.milestones.map((m) => (
              <li key={m.date + m.label} className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-gold/40 hover:bg-white/[0.05]">
                <div className="w-24 shrink-0 text-center">
                  <p className="font-display text-3xl leading-none text-gold">{formatNzDate(m.date).split(" ")[1]}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-mist">{formatNzDate(m.date).split(" ").slice(2).join(" ")}</p>
                </div>
                <div className="flex-1 border-l border-white/10 pl-5">
                  <p className="font-display text-xl text-white">{m.label}</p>
                  {!m.confirmed && <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-mist">Proposed · subject to confirmation</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ───────────── CONTESTANTS ───────────── */}
      <Section tone="ivory" labelledBy="contestants-title">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading eyebrow="Contestants" id="contestants-title" title={contestants.length ? "Meet the finalists." : "The finalists will be revealed."} className="mb-0"
            intro={contestants.length ? undefined : "Official finalists are announced after auditions. Their portraits and stories will appear here."} />
          {contestants.length > 0 && <Link href="/contestants" className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-gold-ink hover:text-espresso">All contestants <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>}
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {contestants.length > 0
            ? contestants.slice(0, 4).map((c) => <ContestantCard key={c.id} c={c} votingOpen={votingState === "open"} />)
            : Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="relative flex aspect-[3/4] flex-col items-center justify-center overflow-hidden rounded-2xl bg-ink text-center">
                  <StageBackdrop intensity="soft" />
                  <KoruMark className="relative w-24 opacity-80" />
                  <p className="relative mt-6 font-display text-2xl text-white">Finalist {String(i + 1).padStart(2, "0")}</p>
                  <p className="relative mt-1 text-[10px] uppercase tracking-[0.24em] text-gold">To be announced</p>
                </div>
              ))}
        </div>
      </Section>

      {/* ───────────── PEOPLE'S CHOICE ───────────── */}
      {sections.peoples_choice && (
        <section aria-labelledby="pc-title" className="on-dark relative isolate overflow-hidden bg-ink py-24 text-ivory sm:py-32">
          <StageBackdrop />
          <div className="container-x relative grid items-center gap-10 lg:grid-cols-2">
            <SectionHeading dark eyebrow="People's Choice Award" id="pc-title" title={<>Your vote. <em className="text-gold-gradient">Their moment.</em></>} className="mb-0" />
            <div>
              <Prose text={sections.peoples_choice.content.body} className="text-mist" />
              <div className="mt-8"><ButtonLink href="/peoples-choice" variant={votingState === "open" ? "primary" : "secondary"}>{votingState === "open" ? "Vote & Support" : "About People's Choice"}</ButtonLink></div>
            </div>
          </div>
        </section>
      )}

      {/* ───────────── PARTNERS ───────────── */}
      <Section tone="cream" labelledBy="partners-title">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          <SectionHeading eyebrow="Partners" id="partners-title" title={partners.length ? "With thanks to our partners." : "Partner with Mr. IndiaNZ."} className="mb-0"
            intro={partners.length ? undefined : "Align your brand with the inaugural Kiwi-Indian men's pageant — on stage at The Cloud and across our community."} />
          {partners.length > 0 ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {partners.slice(0, 9).map((p) => (
                <li key={p.id} className="card flex h-28 items-center justify-center p-5 text-center">
                  {p.logoUrl ? <img src={p.logoUrl} alt={p.name} className="max-h-14 w-auto object-contain" loading="lazy" /> : <span className="font-display text-lg text-espresso">{p.name}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="lg:text-right"><ButtonLink href="/contact?subject=Partnership%20enquiry" variant="outline" size="lg">Partnership enquiries</ButtonLink></div>
          )}
        </div>
      </Section>

      {/* ───────────── FAQ ───────────── */}
      <Section tone="ivory" labelledBy="faq-title">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <SectionHeading eyebrow="FAQ" id="faq-title" title="Questions, answered." />
            <ButtonLink href="/faq" variant="outline">All FAQs</ButtonLink>
          </div>
          <FaqList faqs={faqs.slice(0, 6)} />
        </div>
      </Section>

      {/* ───────────── FINAL CTA ───────────── */}
      <section aria-labelledby="cta-title" className="on-dark relative isolate overflow-hidden bg-ink py-28 text-center text-ivory sm:py-40">
        <StageBackdrop image={media.ctaImage} />
        {media.ctaImage && <p className="absolute bottom-3 right-4 z-10 text-[10px] text-white/50">Photo: Miss India South Pacific 2026 Grand Finale</p>}
        <div className="container-x relative">
          <p className="eyebrow eyebrow-dark">{event.finaleDisplay} · {event.venueShort}</p>
          <h2 id="cta-title" className="mx-auto mt-6 max-w-4xl text-[2.6rem] leading-[1.05] text-white sm:text-7xl">Your stage <em className="text-gold-gradient">awaits</em>.</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/80">Applying is free. No modelling or pageant experience required — just your story, your style and your pride.</p>
          <div className="mt-11 flex flex-col justify-center gap-4 sm:flex-row">
            {applyOpen ? <ButtonLink href="/apply" size="lg">Apply Now</ButtonLink> : <ButtonLink href="/contact?subject=Register%20my%20interest" size="lg">Register your interest</ButtonLink>}
            <ButtonLink href="/faq" variant="secondary" size="lg">Read the FAQ</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
