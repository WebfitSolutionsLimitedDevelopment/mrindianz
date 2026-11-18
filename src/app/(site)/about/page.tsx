/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { Prose, Section, SectionHeading } from "@/components/ui/section";
import { PendingApproval } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { KoruMark } from "@/components/site/stage";
import { getSections, getSettings } from "@/lib/content/repo";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "About",
  description: "A new national platform celebrating the confidence, character, cultural heritage and individuality of Kiwi-Indian men.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const [s, settings] = await Promise.all([getSections("about"), getSettings()]);
  const photos = settings.media.legacy;
  return (
    <>
      <PageHero eyebrow="About Mr. IndiaNZ" title={<>Confidence, character and <em className="text-gold-gradient">culture</em>.</>} intro={settings.event.shortDescription} />

      {s.purpose && (
        <Section tone="ivory" labelledBy="about-purpose">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <SectionHeading eyebrow="Our purpose" id="about-purpose" title={s.purpose.content.title} className="mb-4" />
              {s.purpose.approvalStatus === "pending_approval" && <PendingApproval />}
            </div>
            <Prose text={s.purpose.content.body} className="text-stone first-letter:float-left first-letter:mr-3 first-letter:font-display first-letter:text-7xl first-letter:leading-[0.8] first-letter:text-gold-deep" />
          </div>
        </Section>
      )}

      {s.identity && (
        <Section tone="dark" labelledBy="about-identity" className="overflow-hidden">
          <KoruMark className="absolute -left-20 top-10 w-[30rem] opacity-[0.06]" />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="eyebrow eyebrow-dark">Identity</p>
            <h2 id="about-identity" className="mt-5 text-4xl text-white sm:text-6xl">{s.identity.content.title}</h2>
            <div className="rule-gold mx-auto mt-7" />
            <Prose text={s.identity.content.body} className="mt-8 text-lg text-mist" />
            {s.identity.approvalStatus === "pending_approval" && <div className="mt-6"><PendingApproval dark /></div>}
          </div>
        </Section>
      )}

      {s.legacy && (
        <Section tone="cream" labelledBy="about-legacy">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <SectionHeading eyebrow="Legacy" id="about-legacy" title={s.legacy.content.title} className="mb-6" />
              <Prose text={s.legacy.content.body} className="text-stone" />
              {s.legacy.approvalStatus === "pending_approval" && <div className="mt-5"><PendingApproval /></div>}
            </div>
            {photos.length >= 2 && (
              <div className="grid grid-cols-2 gap-4">
                {photos.slice(1, 3).map((m, i) => (
                  <figure key={m.src} className={i === 1 ? "mt-12 overflow-hidden rounded-2xl" : "overflow-hidden rounded-2xl"}>
                    <img src={m.src} alt={m.alt} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                  </figure>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {s.inaugural && (
        <Section tone="ivory" labelledBy="about-inaugural">
          <div className="card relative overflow-hidden p-10 sm:p-14">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
              <SectionHeading eyebrow="2027" id="about-inaugural" title={s.inaugural.content.title} className="mb-0" />
              <div>
                <Prose text={s.inaugural.content.body} className="text-stone" />
                <div className="mt-8 flex flex-wrap gap-4">
                  <ButtonLink href="/competition">Discover the competition</ButtonLink>
                  <ButtonLink href="/faq" variant="outline">Read the FAQ</ButtonLink>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-10 text-center text-sm text-stone">Presented by <strong className="text-espresso">{settings.event.organiser}</strong>, building on the experience of the teams behind Miss IndiaNZ and Miss India South Pacific.</p>
        </Section>
      )}
    </>
  );
}
