import type { Metadata } from "next";
import Link from "next/link";
import { Prose, Section, SectionHeading } from "@/components/ui/section";
import { PendingApproval } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getSections, getSettings } from "@/lib/content/repo";
import { getRegistrationState } from "@/lib/registration";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "The Competition",
  description: "Rounds, eligibility, auditions, judging principles, rehearsals, contestant fee and awards for Mr. IndiaNZ 2027.",
  alternates: { canonical: "/competition" },
};

export default async function CompetitionPage() {
  const [s, settings, reg] = await Promise.all([getSections("competition"), getSettings(), getRegistrationState()]);
  const rounds = s.rounds;
  const elig = s.eligibility;
  const textSections = ["auditions", "judging", "rehearsals", "fee", "awards", "process"] as const;

  return (
    <>
      <Section tone="dark" className="border-b border-line">
        <SectionHeading as="h1" eyebrow="The competition" title="Rounds, eligibility and judging"
          intro={`Grand Finale: ${settings.event.finaleDisplay} at ${settings.event.venueName}, Auckland.`} />
        <nav aria-label="On this page" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[["#rounds", "Rounds"], ["#eligibility", "Eligibility"], ["#auditions", "Auditions"], ["#judging", "Judging"], ["#rehearsals", "Rehearsals"], ["#fee", "Contestant fee"], ["#awards", "Awards"], ["#process", "Application process"]].map(([h, l]) => (
            <a key={h} href={h} className="text-gold underline-offset-4 hover:underline">{l}</a>
          ))}
        </nav>
      </Section>

      {rounds && (
        <Section tone="light" id="rounds" labelledBy="rounds-h">
          <SectionHeading id="rounds-h" title={rounds.content.title} intro={rounds.content.body} />
          <ol className="grid gap-6 md:grid-cols-2">
            {rounds.content.items?.map((r) => (
              <li key={r.title} className="border-t-2 border-gold-deep bg-ivory-2 p-6">
                <h3 className="text-2xl">{r.title}</h3>
                <p className="mt-2 text-stone">{r.body}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {elig && (
        <Section tone="dark" id="eligibility" labelledBy="elig-h">
          <SectionHeading id="elig-h" title="Eligibility" intro={elig.content.body} />
          {(!settings.registration.eligibilityApproved || !settings.registration.agePolicyApproved) && (
            <p className="mb-8"><PendingApproval label="Draft — eligibility and age policy pending organiser & legal approval" /></p>
          )}
          <dl className="grid gap-6 md:grid-cols-2">
            {elig.content.items?.map((i) => (
              <div key={i.title} className="border border-line p-6">
                <dt className="font-display text-2xl">{i.title}</dt>
                <dd className="mt-2 text-mist">{i.body}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {textSections.map((key, idx) => {
        const sec = s[key];
        if (!sec) return null;
        const light = idx % 2 === 0;
        return (
          <Section key={key} tone={light ? "light" : "charcoal"} id={key} labelledBy={`${key}-h`}>
            <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
              <div>
                <SectionHeading id={`${key}-h`} title={sec.content.title} />
                {sec.approvalStatus === "pending_approval" && <PendingApproval light={light} />}
                {key === "fee" && !settings.event.contestantFeeTermsApproved && (
                  <p className="mt-3"><PendingApproval light={light} label="GST, due date & refund terms to be confirmed" /></p>
                )}
              </div>
              <Prose text={sec.content.body} className={light ? "text-ink/85" : "text-ivory/85"} />
            </div>
          </Section>
        );
      })}

      <section className="bg-ink py-16 text-center">
        <div className="container-x">
          <h2 className="text-4xl">Questions?</h2>
          <p className="mt-3 text-mist">See the <Link className="text-gold underline" href="/faq">FAQ</Link> or <Link className="text-gold underline" href="/contact">contact the team</Link>.</p>
          {reg.state === "open" && <div className="mt-8"><ButtonLink href="/apply" size="lg">Apply now — it&apos;s free</ButtonLink></div>}
        </div>
      </section>
    </>
  );
}
