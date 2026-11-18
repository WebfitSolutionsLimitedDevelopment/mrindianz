import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { PRIVACY } from "@/lib/content/legal";
import { getSettings } from "@/lib/content/repo";

export const revalidate = 60;
export const metadata: Metadata = { title: "Privacy statement", alternates: { canonical: "/privacy" } };

export default async function Page() {
  const { legal } = await getSettings();
  return <LegalPage doc={PRIVACY} version={legal.versions.privacy} approved={legal.approved.privacy} />;
}
