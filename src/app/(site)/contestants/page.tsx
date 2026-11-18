import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { ContestantGallery } from "@/components/site/contestant-gallery";
import { getPublishedContestants } from "@/lib/contestants/repo";
import { getActiveCampaign } from "@/lib/voting/repo";
import { effectiveVotingState } from "@/lib/voting/state";
import { getRegistrationState } from "@/lib/registration";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Contestants",
  description: "Meet the finalists of Mr. IndiaNZ 2027.",
  alternates: { canonical: "/contestants" },
};

export default async function ContestantsPage() {
  const [contestants, campaign, reg] = await Promise.all([getPublishedContestants(), getActiveCampaign(), getRegistrationState()]);
  const votingOpen = campaign ? effectiveVotingState(campaign) === "open" : false;
  return (
    <>
      <Section tone="dark" className="border-b border-line">
        <SectionHeading as="h1" eyebrow="Mr. IndiaNZ 2027" title="Contestants" />
      </Section>
      <Section tone="dark" className="pt-10">
        {contestants.length === 0 ? (
          <EmptyState title="Contestants coming soon"
            action={reg.state === "open" ? <ButtonLink href="/apply">Apply now — it&apos;s free</ButtonLink> : <ButtonLink href="/competition" variant="secondary">About the competition</ButtonLink>}>
            Approved finalists, their portraits and biographies will be published here after selection.
          </EmptyState>
        ) : (
          <ContestantGallery contestants={contestants} votingOpen={votingOpen} />
        )}
      </Section>
    </>
  );
}
