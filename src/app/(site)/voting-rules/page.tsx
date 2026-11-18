import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { VOTING_RULES } from "@/lib/content/legal";
import { getSettings } from "@/lib/content/repo";

export const revalidate = 60;
export const metadata: Metadata = { title: "Voting rules", alternates: { canonical: "/voting-rules" } };

export default async function Page() {
  const { legal } = await getSettings();
  return <LegalPage doc={VOTING_RULES} version={legal.versions.votingRules} approved={legal.approved.votingRules} />;
}
