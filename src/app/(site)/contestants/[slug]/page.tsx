/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { StageBackdrop } from "@/components/site/stage";
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
      <section className="on-dark relative isolate overflow-hidden bg-ink pb-20 pt-32 text-ivory sm:pt-40">
        <StageBackdrop intensity="soft" />
        <div className="container-x relative">
          <nav aria-label="Breadcrumb" className="mb-10 text-xs uppercase tracking-[0.18em] text-mist">
            <ol className="flex flex-wrap gap-2">
              <li><Link href="/" className="hover:text-gold">Home</Link> /</li>
              <li><Link href="/contestants" className="hover:text-gold">Contestants</Link> /</li>
              <li aria-current="page" className="text-white">{c.name}</li>
            </ol>
          </nav>
          <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] shadow-[0_40px_80px_-30px_rgba(0,0,0,.9)] ring-1 ring-gold/30">
              {c.imageUrl ? <img src={c.imageUrl} alt={`Portrait of ${c.name}`} className="h-full w-full object-cover object-top" fetchPriority="high" /> : <PortraitPlaceholder name={c.name} number={c.number} />}
            </div>
            <div className="pb-4">
              {c.number !== null && <p className="eyebrow eyebrow-dark">Contestant {String(c.number).padStart(2, "0")}</p>}
              <h1 className="mt-4 text-5xl leading-[1.02] text-white sm:text-7xl">{c.name}</h1>
              {c.cityRegion && <p className="mt-3 text-lg text-mist">{c.cityRegion}</p>}
              <div className="rule-gold mt-7" />
              {row && (row.votes !== null || row.rank !== null) && (
                <div className="mt-8 flex flex-wrap gap-4">
                  {row.rank !== null && <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4"><p className="font-display text-4xl text-gold-gradient">#{row.rank}</p><p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-mist">People&apos;s Choice</p></div>}
                  {row.votes !== null && <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4"><p className="font-display text-4xl text-gold-gradient">{row.votes.toLocaleString("en-NZ")}</p><p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-mist">Verified votes</p></div>}
                </div>
              )}
              <div className="mt-9 flex flex-wrap gap-4">
                {votingOpen && <ButtonLink href="#vote" size="lg">Vote &amp; Support</ButtonLink>}
                <ShareTools url={url} title={`${c.name} — Mr. IndiaNZ 2027`} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section tone="ivory" labelledBy="bio-h">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="eyebrow">Biography</p>
            <h2 id="bio-h" className="mt-3 text-4xl text-espresso">About {c.name.split(" ")[0]}</h2>
            <div className="rule-gold mt-6" />
            <div className="prose-site mt-8 text-stone">
              {paragraphs(c.biography ?? c.shortBio).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </div>
          <aside className="space-y-5">
            {c.interests.length > 0 && (
              <div className="card p-6"><p className="eyebrow">Interests</p>
                <ul className="mt-4 flex flex-wrap gap-2">{c.interests.map((i) => <li key={i} className="rounded-full border border-espresso/15 px-3 py-1 text-sm text-espresso">{i}</li>)}</ul>
              </div>
            )}
            {c.talentInfo && <div className="card p-6"><p className="eyebrow">Mr. Talent</p><p className="mt-3 text-stone">{c.talentInfo}</p></div>}
            {Object.keys(c.socialLinks).length > 0 && (
              <div className="card p-6"><p className="eyebrow">Follow</p>
                <ul className="mt-4 flex flex-wrap gap-2">{Object.entries(c.socialLinks).map(([k, v]) => <li key={k}><a href={v} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-full bg-ink px-4 py-1.5 text-xs uppercase tracking-[0.14em] text-gold hover:bg-charcoal-2">{k}<span className="sr-only"> (opens in a new tab)</span></a></li>)}</ul>
              </div>
            )}
            <div className="card p-6">
              <p className="eyebrow">Profile QR code</p>
              <div className="mt-4 flex items-center gap-5">
                <img src={`/api/qr/${c.slug}?format=svg`} alt={`QR code linking to ${c.name}'s profile`} width={120} height={120} className="h-28 w-28 rounded-lg border border-espresso/10 bg-white p-1.5" />
                <div className="space-y-2 text-sm">
                  <a href={`/api/qr/${c.slug}?format=png&download=1`} className="block text-gold-ink underline">Download PNG</a>
                  <a href={`/api/qr/${c.slug}?format=svg&download=1`} className="block text-gold-ink underline">Download SVG</a>
                  <Link href={`/contestants/${c.slug}/qr`} className="block text-gold-ink underline">Print-friendly</Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </Section>

      {gallery.length > 0 && (
        <Section tone="cream" labelledBy="gallery-h">
          <h2 id="gallery-h" className="mb-8 text-4xl text-espresso">Gallery</h2>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {gallery.map((g) => g.url && <li key={g.id} className="aspect-[4/5] overflow-hidden rounded-2xl"><img src={g.url} alt={g.alt || `Photo of ${c.name}`} loading="lazy" className="h-full w-full object-cover" /></li>)}
          </ul>
        </Section>
      )}

      <section id="vote" aria-labelledby="vote-h" className="on-dark relative isolate scroll-mt-20 overflow-hidden bg-ink py-20 text-ivory sm:py-28">
        <StageBackdrop intensity="soft" />
        <div className="container-x relative grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow eyebrow-dark">People&apos;s Choice</p>
            <h2 id="vote-h" className="mt-4 text-4xl text-white sm:text-5xl">Vote &amp; support <em className="text-gold-gradient">{c.name.split(" ")[0]}</em></h2>
            <div className="rule-gold mt-6" />
            <p className="mt-6 text-mist">{voting ? VOTING_STATE_LABELS[voting.state] : "People's Choice voting has not been announced yet."} The People&apos;s Choice Award is separate from the main title.</p>
            {sp.checkout === "cancelled" && <p role="status" className="mt-5 rounded-2xl border border-gold/50 p-4 text-sm text-gold">Checkout was cancelled. You have not been charged.</p>}
          </div>
          <div className="card p-6 text-espresso sm:p-10">
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
              <p className="text-stone">Voting is not open for this contestant right now. <Link href="/peoples-choice" className="text-gold-ink underline">About People&apos;s Choice</Link></p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
