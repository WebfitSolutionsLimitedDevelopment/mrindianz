import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { CONTESTANT_TERMS } from "@/lib/content/legal";
import { getSettings } from "@/lib/content/repo";

export const revalidate = 60;
export const metadata: Metadata = { title: "Contestant terms", alternates: { canonical: "/contestant-terms" } };

export default async function Page() {
  const { legal } = await getSettings();
  return <LegalPage doc={CONTESTANT_TERMS} version={legal.versions.contestantTerms} approved={legal.approved.contestantTerms} />;
}
