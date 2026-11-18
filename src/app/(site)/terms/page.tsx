import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { WEBSITE_TERMS } from "@/lib/content/legal";
import { getSettings } from "@/lib/content/repo";

export const revalidate = 60;
export const metadata: Metadata = { title: "Website terms", alternates: { canonical: "/terms" } };

export default async function Page() {
  const { legal } = await getSettings();
  return <LegalPage doc={WEBSITE_TERMS} version={legal.versions.websiteTerms} approved={legal.approved.websiteTerms} />;
}
