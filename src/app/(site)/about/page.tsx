import type { Metadata } from "next";
import { Prose, Section, SectionHeading } from "@/components/ui/section";
import { PendingApproval } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getSections, getSettings } from "@/lib/content/repo";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "About",
  description: "A new national platform celebrating the confidence, character, cultural heritage and individuality of Kiwi-Indian men.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const [s, settings] = await Promise.all([getSections("about"), getSettings()]);
  const order = ["purpose", "identity", "legacy", "inaugural"] as const;
  return (
    <>
      <Section tone="dark" className="border-b border-line">
        <SectionHeading as="h1" eyebrow="About" title="About Mr. IndiaNZ" intro={settings.event.shortDescription} />
      </Section>
      {order.map((key, i) => {
        const sec = s[key];
        if (!sec) return null;
        const light = i % 2 === 0;
        return (
          <Section key={key} tone={light ? "light" : "dark"} labelledBy={`about-${key}`}>
            <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
              <div>
                <SectionHeading id={`about-${key}`} title={sec.content.title} />
                {sec.approvalStatus === "pending_approval" && <PendingApproval light={light} />}
              </div>
              <Prose text={sec.content.body} className={light ? "text-ink/85" : "text-ivory/85"} />
            </div>
          </Section>
        );
      })}
      <Section tone="charcoal" labelledBy="about-organiser">
        <SectionHeading
          id="about-organiser"
          eyebrow="Organiser"
          title={settings.event.organiser}
          intro="Mr. IndiaNZ is produced by Rhythm House Events & Films, building on the experience of the teams behind Miss IndiaNZ and Miss India South Pacific."
        />
        <ButtonLink href="/competition" variant="secondary">Discover the competition</ButtonLink>
      </Section>
    </>
  );
}
