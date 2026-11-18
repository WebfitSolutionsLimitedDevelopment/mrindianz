import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/section";
import { PageHero } from "@/components/site/page-hero";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ContestantCard } from "@/components/site/contestant-card";
import { Leaderboard } from "@/components/voting/leaderboard";
import { VoteFlow } from "@/components/voting/vote-flow";
import { getVotingPageData } from "@/lib/voting/page-data";
import { getPublishedContestants } from "@/lib/contestants/repo";
import { VOTING_STATE_LABELS } from "@/lib/voting/state";
import { formatCents, formatNzDateTime } from "@/lib/format";
import { getSettings } from "@/lib/content/repo";

export const revalidate = 15;
export const metadata: Metadata = {
  title: "People's Choice",
  description: "Support your favourite Mr. IndiaNZ 2027 finalist in the People's Choice Award.",
  alternates: { canonical: "/peoples-choice" },
};

export default async function PeoplesChoicePage() {
  const [data, contestants, settings] = await Promise.all([getVotingPageData(), getPublishedContestants(), getSettings()]);

  if (!data) {
    return (
      <>
        <PageHero eyebrow="People's Choice Award" title={<>Your vote. <em className="text-gold-gradient">Their moment.</em></>}
          intro="Supporters will be able to back their favourite finalist once finalists are announced. The People's Choice Award is separate from the main Mr. IndiaNZ title." />
        <Section tone="cream">
          <EmptyState title="Voting opens after finalists are announced" action={<ButtonLink href="/voting-rules" variant="outline">Read the draft voting rules</ButtonLink>}>
            Voting dates, packages and rules will be published here.
          </EmptyState>
        </Section>
      </>
    );
  }

  const { campaign, state, packages, leaderboard, total, history } = data;
  const eligible = contestants.filter((c) => c.votingEligible);
  const open = state === "open";
  const live = open && !campaign.leaderboard_frozen_at;

  return (
    <>
      <PageHero eyebrow="People's Choice Award" title={campaign.is_demo ? <>People&apos;s Choice <em className="text-gold-gradient">(demo)</em></> : <>Your vote. <em className="text-gold-gradient">Their moment.</em></>}
        intro="Support your favourite finalist. Every vote is counted only after payment is verified. The People's Choice Award is separate from the main Mr. IndiaNZ title.">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={open ? "successDark" : "gold"}>{VOTING_STATE_LABELS[state]}</Badge>
          {campaign.opens_at && <span className="text-sm text-mist">Opens {formatNzDateTime(campaign.opens_at)}</span>}
          {campaign.closes_at && <span className="text-sm text-mist">· Closes {formatNzDateTime(campaign.closes_at)} (NZ time)</span>}
          {campaign.leaderboard_frozen_at && <span className="text-sm text-gold">Leaderboard frozen at {formatNzDateTime(campaign.leaderboard_frozen_at)}</span>}
        </div>
        {campaign.is_demo && <p className="mt-5 max-w-2xl rounded-2xl border border-gold/50 bg-gold/10 p-4 text-sm text-gold-bright" role="note">Demo environment: no real payments are taken and demo votes never appear on the live website.</p>}
      </PageHero>

      {open && (
        <Section tone="cream" labelledBy="vote-h">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <p className="eyebrow">Vote &amp; Support</p>
              <h2 id="vote-h" className="mt-3 text-4xl text-espresso sm:text-5xl">Choose your finalist</h2>
              <div className="rule-gold mt-6" />
              <p className="mt-6 text-stone">Choose a contestant and a voting package. You don&apos;t need an account.</p>
              <h3 className="eyebrow mt-10 font-sans">Voting packages</h3>
              <ul className="card mt-4 divide-y divide-espresso/10 px-5 text-sm">
                {packages.map((p) => (
                  <li key={p.id} className="flex justify-between py-3"><span className="text-espresso">{p.name} <span className="text-stone">· {p.votes.toLocaleString("en-NZ")} votes</span></span><span className="font-semibold text-gold-ink">{formatCents(p.priceCents)}</span></li>
                ))}
              </ul>
              {packages.some((p) => p.isDemoValue) && <p className="mt-3 text-xs text-stone">Prices shown are demonstration values and are not yet approved.</p>}
              {campaign.price_note && <p className="mt-2 text-xs text-stone">{campaign.price_note}</p>}
            </div>
            <div className="card p-6 sm:p-10">
            <VoteFlow
              campaignId={campaign.id}
              contestants={eligible.map((c) => ({ id: c.id, name: c.name, number: c.number }))}
              packages={packages}
              maxQuantityPerOrder={campaign.max_quantity_per_order}
              paymentsReady={data.paymentsReady}
              demoMode={data.demoMode}
              priceNote={campaign.price_note}
            />
            </div>
          </div>
        </Section>
      )}

      {campaign.show_leaderboard && (
        <Section tone="ivory" labelledBy="lb-h">
          <p className="eyebrow">Live standings</p>
          <h2 id="lb-h" className="mb-10 mt-3 text-4xl text-espresso sm:text-5xl">{state === "finalised" && campaign.results_published ? "Final results" : "Leaderboard"}</h2>
          <div className="card p-4 sm:p-8"><Leaderboard initial={leaderboard} initialTotal={total} refreshSeconds={campaign.refresh_interval_seconds} votingOpen={open} live={live} /></div>
        </Section>
      )}

      {eligible.length > 0 && (
        <Section tone="cream" labelledBy="pc-contestants">
          <h2 id="pc-contestants" className="mb-10 text-4xl text-espresso sm:text-5xl">The finalists</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {eligible.map((c) => <ContestantCard key={c.id} c={c} votingOpen={open} />)}
          </div>
        </Section>
      )}

      {history.length > 0 && (
        <Section tone="ivory" labelledBy="hist-h">
          <h2 id="hist-h" className="mb-6 text-3xl text-espresso">Recent support</h2>
          <ul className="card divide-y divide-espresso/10 px-6 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-3">
                <span><strong>{h.supporter}</strong> supported <Link href={`/contestants/${h.contestant_slug}`} className="text-gold-ink underline">{h.contestant_name}</Link></span>
                <span className="text-stone">{h.votes.toLocaleString("en-NZ")} votes · {formatNzDateTime(h.approx_time, { minute: undefined })}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section tone="dark" labelledBy="rules-h">
        <h2 id="rules-h" className="text-3xl text-white sm:text-4xl">Voting rules in brief</h2>
        <ul className="mt-8 grid gap-3 text-mist sm:grid-cols-2 [&>li]:rounded-2xl [&>li]:border [&>li]:border-white/10 [&>li]:p-5">
          <li>The People&apos;s Choice Award is separate from the main Mr. IndiaNZ title.</li>
          <li>Votes are credited only after payment is verified. Pending or failed payments do not count.</li>
          <li>Refunded or disputed payments have their votes removed.</li>
          <li>Your email and payment details are never shown publicly. You can appear as Anonymous.</li>
          <li>Payments are processed securely by Stripe. Card details never touch this website.</li>
        </ul>
        <p className="mt-6"><Link href="/voting-rules" className="font-semibold text-gold underline">Read the full voting rules</Link>{!settings.legal.approved.votingRules && " (draft — pending approval)"}</p>
      </Section>
    </>
  );
}
