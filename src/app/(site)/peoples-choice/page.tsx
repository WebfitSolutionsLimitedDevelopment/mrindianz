import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/ui/section";
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
        <Section tone="dark" className="border-b border-line">
          <SectionHeading as="h1" eyebrow="People's Choice" title="People's Choice Award"
            intro="Supporters will be able to back their favourite finalist once finalists are announced. The People's Choice Award is separate from the main Mr. IndiaNZ title." />
        </Section>
        <Section tone="charcoal">
          <EmptyState title="Voting opens after finalists are announced" action={<ButtonLink href="/voting-rules" variant="secondary">Read the draft voting rules</ButtonLink>}>
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
      <Section tone="dark" className="border-b border-line">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading as="h1" eyebrow="People's Choice" title={campaign.is_demo ? "People's Choice (demo)" : "People's Choice Award"}
            intro="Support your favourite finalist. Every vote is counted only after payment is verified. The People's Choice Award is separate from the main Mr. IndiaNZ title." />
          <div className="mb-10 space-y-2 lg:text-right">
            <Badge tone={open ? "success" : "gold"}>{VOTING_STATE_LABELS[state]}</Badge>
            {campaign.opens_at && <p className="text-sm text-mist">Opens {formatNzDateTime(campaign.opens_at)}</p>}
            {campaign.closes_at && <p className="text-sm text-mist">Closes {formatNzDateTime(campaign.closes_at)} (NZ time)</p>}
            {campaign.leaderboard_frozen_at && <p className="text-sm text-gold">Leaderboard frozen at {formatNzDateTime(campaign.leaderboard_frozen_at)}</p>}
          </div>
        </div>
        {campaign.is_demo && <p className="border border-gold p-3 text-sm text-gold" role="note">Demo environment: no real payments are taken and demo votes never appear on the live website.</p>}
      </Section>

      {open && (
        <Section tone="charcoal" labelledBy="vote-h">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <h2 id="vote-h" className="text-4xl">Vote &amp; Support</h2>
              <p className="mt-4 text-mist">Choose a contestant and a voting package. You don&apos;t need an account.</p>
              <h3 className="mt-8 eyebrow font-sans">Voting packages</h3>
              <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
                {packages.map((p) => (
                  <li key={p.id} className="flex justify-between py-2"><span>{p.name} — {p.votes.toLocaleString("en-NZ")} votes</span><span className="text-gold">{formatCents(p.priceCents)}</span></li>
                ))}
              </ul>
              {packages.some((p) => p.isDemoValue) && <p className="mt-2 text-xs text-mist">Prices shown are demonstration values and are not yet approved.</p>}
              {campaign.price_note && <p className="mt-2 text-xs text-mist">{campaign.price_note}</p>}
            </div>
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
        </Section>
      )}

      {campaign.show_leaderboard && (
        <Section tone="dark" labelledBy="lb-h">
          <h2 id="lb-h" className="mb-8 text-4xl sm:text-5xl">{state === "finalised" && campaign.results_published ? "Final results" : "Leaderboard"}</h2>
          <Leaderboard initial={leaderboard} initialTotal={total} refreshSeconds={campaign.refresh_interval_seconds} votingOpen={open} live={live} />
        </Section>
      )}

      {eligible.length > 0 && (
        <Section tone="charcoal" labelledBy="pc-contestants">
          <h2 id="pc-contestants" className="mb-8 text-4xl">The finalists</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {eligible.map((c) => <ContestantCard key={c.id} c={c} votingOpen={open} />)}
          </div>
        </Section>
      )}

      {history.length > 0 && (
        <Section tone="dark" labelledBy="hist-h">
          <h2 id="hist-h" className="mb-6 text-3xl">Recent support</h2>
          <ul className="divide-y divide-line border-y border-line text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-3">
                <span><strong>{h.supporter}</strong> supported <Link href={`/contestants/${h.contestant_slug}`} className="text-gold underline">{h.contestant_name}</Link></span>
                <span className="text-mist">{h.votes.toLocaleString("en-NZ")} votes · {formatNzDateTime(h.approx_time, { minute: undefined })}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section tone="light" labelledBy="rules-h">
        <h2 id="rules-h" className="text-3xl">Voting rules in brief</h2>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-stone">
          <li>The People&apos;s Choice Award is separate from the main Mr. IndiaNZ title.</li>
          <li>Votes are credited only after payment is verified. Pending or failed payments do not count.</li>
          <li>Refunded or disputed payments have their votes removed.</li>
          <li>Your email and payment details are never shown publicly. You can appear as Anonymous.</li>
          <li>Payments are processed securely by Stripe. Card details never touch this website.</li>
        </ul>
        <p className="mt-6"><Link href="/voting-rules" className="font-semibold text-gold-ink underline">Read the full voting rules</Link>{!settings.legal.approved.votingRules && " (draft — pending approval)"}</p>
      </Section>
    </>
  );
}
