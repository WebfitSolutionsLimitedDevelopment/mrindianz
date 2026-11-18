/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section } from "@/components/ui/section";
import { PortraitPlaceholder } from "@/components/site/contestant-card";
import { ShareTools } from "@/components/site/share-tools";
import { JsonLd } from "@/components/site/json-ld";
import { VoteFlow } from "@/components/voting/vote-flow";
import { getContestantBySlug, getContestantGallery, getPublishedContestants } from "@/lib/contestants/repo";
import { getVotingPageData } from "@/lib/voting/page-data";
import { VOTING_STATE_LABELS } from "@/lib/voting/state";
import { absoluteUrl, contestantPath } from "@/lib/site";
import { paragraphs } from "@/lib/format";

export const revalidate = 30;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ checkout?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getContestantBySlug(slug);
  if (!c) return { title: "Contestant not found", robots: { index: false } };
  const title = `${c.name}${c.number !== null ? ` — Contestant ${String(c.number).padStart(2, "0")}` : ""}`;
  return {
    title,
    description: c.shortBio ?? `Meet ${c.name}, a Mr. IndiaNZ 2027 contestant.`,
    alternates: { canonical: contestantPath(c.slug) },
    openGraph: { title, type: "profile", url: absoluteUrl(contestantPath(c.slug)), images: c.imageUrl ? [{ url: c.imageUrl }] : undefined },
  };
}

export default async function ContestantPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const c = await getContestantBySlug(slug);
  if (!c) notFound();
  const [gallery, voting, all] = await Promise.all([getContestantGallery(c.id), getVotingPageData(), getPublishedContestants()]);
  const url = absoluteUrl(contestantPath(c.slug));
  const row = voting?.leaderboard.find((r) => r.contestantId === c.id);
  const votingOpen = voting?.state === "open" && c.votingEligible;

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Contestants", item: absoluteUrl("/contestants") },
          { "@type": "ListItem", position: 3, name: c.name, item: url },
        ],
      }} />
      <Section tone="dark" className="border-b border-line pt-8 sm:pt-10">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-mist">
          <ol className="flex flex-wrap gap-2">
            <li><Link href="/" className="hover:text-gold">Home</Link> /</li>
            <li><Link href="/contestants" className="hover:text-gold">Contestants</Link> /</li>
            <li aria-current="page" className="text-ivory">{c.name}</li>
          </ol>
        </nav>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="aspect-[4/5] w-full overflow-hidden border border-line">
            {c.imageUrl ? <img src={c.imageUrl} alt={`Portrait of ${c.name}`} className="h-full w-full object-cover object-top" fetchPriority="high" /> : <PortraitPlaceholder name={c.name} number={c.number} />}
          </div>
          <div>
            {c.number !== null && <p className="eyebrow">Contestant {String(c.number).padStart(2, "0")}</p>}
            <h1 className="mt-2 text-5xl sm:text-7xl">{c.name}</h1>
            {c.cityRegion && <p className="mt-2 text-lg text-mist">{c.cityRegion}</p>}
            {row && (row.votes !== null || row.rank !== null) && (
              <p className="mt-6 flex gap-6 text-sm">
                {row.rank !== null && <span><span className="font-display text-4xl text-gold">#{row.rank}</span> <span className="text-mist">People&apos;s Choice</span></span>}
                {row.votes !== null && <span><span className="font-display text-4xl text-gold">{row.votes.toLocaleString("en-NZ")}</span> <span className="text-mist">verified votes</span></span>}
              </p>
            )}
            <div className="prose-site mt-8 text-ivory/90">
              {paragraphs(c.biography ?? c.shortBio).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            {c.interests.length > 0 && (
              <div className="mt-8"><h2 className="eyebrow font-sans">Interests</h2>
                <ul className="mt-3 flex flex-wrap gap-2">{c.interests.map((i) => <li key={i} className="border border-line px-3 py-1 text-sm">{i}</li>)}</ul>
              </div>
            )}
            {c.talentInfo && <div className="mt-8"><h2 className="eyebrow font-sans">Mr. Talent</h2><p className="mt-2 text-ivory/90">{c.talentInfo}</p></div>}
            {Object.keys(c.socialLinks).length > 0 && (
              <div className="mt-8"><h2 className="eyebrow font-sans">Follow</h2>
                <ul className="mt-3 flex flex-wrap gap-4">{Object.entries(c.socialLinks).map(([k, v]) => <li key={k}><a href={v} target="_blank" rel="noopener noreferrer" className="capitalize text-gold underline">{k}<span className="sr-only"> (opens in a new tab)</span></a></li>)}</ul>
              </div>
            )}
            <div className="mt-10 space-y-4 border-t border-line pt-8">
              <ShareTools url={url} title={`${c.name} — Mr. IndiaNZ 2027`} />
            </div>
          </div>
        </div>
      </Section>

      {gallery.length > 0 && (
        <Section tone="charcoal" labelledBy="gallery-h">
          <h2 id="gallery-h" className="mb-8 text-4xl">Gallery</h2>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {gallery.map((g) => g.url && <li key={g.id} className="aspect-[4/5] overflow-hidden"><img src={g.url} alt={g.alt || `Photo of ${c.name}`} loading="lazy" className="h-full w-full object-cover" /></li>)}
          </ul>
        </Section>
      )}

      <Section tone="dark" id="vote" labelledBy="vote-h">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow">People&apos;s Choice</p>
            <h2 id="vote-h" className="mt-2 text-4xl sm:text-5xl">Vote &amp; Support {c.name}</h2>
            <p className="mt-4 text-mist">{voting ? VOTING_STATE_LABELS[voting.state] : "People's Choice voting has not been announced yet."} The People&apos;s Choice Award is separate from the main title.</p>
            {sp.checkout === "cancelled" && <p role="status" className="mt-4 border border-gold/60 p-3 text-sm text-gold">Checkout was cancelled. You have not been charged.</p>}
            <div className="mt-8 border border-line bg-white p-4 sm:max-w-[220px]">
              <img src={`/api/qr/${c.slug}?format=svg`} alt={`QR code linking to ${c.name}'s profile`} width={200} height={200} className="h-auto w-full" />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <a href={`/api/qr/${c.slug}?format=png&download=1`} className="text-gold underline">Download QR (PNG)</a>
              <a href={`/api/qr/${c.slug}?format=svg&download=1`} className="text-gold underline">Download QR (SVG)</a>
              <Link href={`/contestants/${c.slug}/qr`} className="text-gold underline">Print-friendly</Link>
            </div>
          </div>
          <div>
            {votingOpen && voting ? (
              <VoteFlow
                campaignId={voting.campaign.id}
                contestants={all.filter((x) => x.votingEligible).map((x) => ({ id: x.id, name: x.name, number: x.number }))}
                fixedContestantId={c.id}
                packages={voting.packages}
                maxQuantityPerOrder={voting.campaign.max_quantity_per_order}
                paymentsReady={voting.paymentsReady}
                demoMode={voting.demoMode}
                priceNote={voting.campaign.price_note}
              />
            ) : (
              <p className="border border-line p-6 text-mist">Voting is not open for this contestant right now. <Link href="/peoples-choice" className="text-gold underline">About People&apos;s Choice</Link></p>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
