import type { Metadata } from "next";
import Link from "next/link";
import { Prose, Section, SectionHeading } from "@/components/ui/section";
import { PendingApproval } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { getSections, getSettings } from "@/lib/content/repo";
import { getRegistrationState } from "@/lib/registration";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "The Competition",
  description: "Rounds, eligibility, auditions, judging principles, rehearsals, contestant fee and awards for Mr. IndiaNZ 2027.",
  alternates: { canonical: "/competition" },
};

const NAV = [["#rounds", "Rounds"], ["#eligibility", "Eligibility"], ["#auditions", "Auditions"], ["#judging", "Judging"], ["#rehearsals", "Rehearsals"], ["#fee", "Contestant fee"], ["#awards", "Awards"], ["#process", "Process"]];

export default async function CompetitionPage() {
  const [s, settings, reg] = await Promise.all([getSections("competition"), getSettings(), getRegistrationState()]);
  const rounds = s.rounds;
  const elig = s.eligibility;
  const textSections = ["auditions", "judging", "rehearsals", "fee", "awards", "process"] as const;

  return (
    <>
      <PageHero eyebrow="The competition" title={<>Rounds, eligibility <em className="text-gold-gradient">&amp; judging</em>.</>}
        intro={`Grand Finale: ${settings.event.finaleDisplay} at ${settings.event.venueName}, Auckland.`}>
        <nav aria-label="On this page" className="flex flex-wrap gap-2">
          {NAV.map(([h, l]) => (
            <a key={h} href={h} className="rounded-full border border-white/25 px-4 py-1.5 text-xs uppercase tracking-[0.14em] text-white/85 transition hover:border-gold hover:text-gold">{l}</a>
          ))}
        </nav>
      </PageHero>

      {rounds && (
        <Section tone="ivory" id="rounds" labelledBy="rounds-h">
          <SectionHeading eyebrow="Format" id="rounds-h" title={rounds.content.title} intro={rounds.content.body} />
          <ol className="grid gap-6 md:grid-cols-2">
            {rounds.content.items?.map((r, i) => (
              <li key={r.title} className="card relative overflow-hidden p-8">
                <span className="absolute right-6 top-3 font-display text-7xl text-gold/15" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-2xl text-espresso sm:text-3xl">{r.title}</h3>
                <p className="mt-3 leading-relaxed text-stone">{r.body}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {elig && (
        <Section tone="dark" id="eligibility" labelledBy="elig-h">
          <SectionHeading dark eyebrow="Who can enter" id="elig-h" title="Eligibility" intro={elig.content.body} />
          {(!settings.registration.eligibilityApproved || !settings.registration.agePolicyApproved) && (
            <p className="-mt-4 mb-10"><PendingApproval dark label="Draft — eligibility & age policy pending organiser and legal approval" /></p>
          )}
          <dl className="grid gap-5 md:grid-cols-2">
            {elig.content.items?.map((i) => (
              <div key={i.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <dt className="font-display text-2xl text-white">{i.title}</dt>
                <dd className="mt-2 leading-relaxed text-mist">{i.body}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {textSections.map((key, idx) => {
        const sec = s[key];
        if (!sec) return null;
        const cream = idx % 2 === 1;
        return (
          <Section key={key} tone={cream ? "cream" : "ivory"} id={key} labelledBy={`${key}-h`} className="py-16 sm:py-20">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
              <div>
                <SectionHeading id={`${key}-h`} title={sec.content.title} className="mb-4" />
                <div className="flex flex-wrap gap-2">
                  {sec.approvalStatus === "pending_approval" && <PendingApproval />}
                  {key === "fee" && !settings.event.contestantFeeTermsApproved && <PendingApproval label="GST, due date & refund terms to be confirmed" />}
                </div>
              </div>
              <Prose text={sec.content.body} className="text-stone" />
            </div>
          </Section>
        );
      })}

      <Section tone="dark" className="text-center">
        <h2 className="text-4xl text-white sm:text-5xl">Questions?</h2>
        <p className="mt-4 text-mist">See the <Link className="text-gold underline" href="/faq">FAQ</Link> or <Link className="text-gold underline" href="/contact">contact the team</Link>.</p>
        {reg.state === "open" && <div className="mt-9"><ButtonLink href="/apply" size="lg">Apply now — it&apos;s free</ButtonLink></div>}
      </Section>
    </>
  );
}
