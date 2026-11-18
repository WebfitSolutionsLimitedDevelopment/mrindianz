import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { FaqList } from "@/components/site/faq-list";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { getFaqs } from "@/lib/content/repo";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about applying, the competition, fees and People's Choice voting.",
  alternates: { canonical: "/faq" },
};

const CATEGORY_LABELS: Record<string, string> = { applying: "Applying", competition: "The competition", fees: "Fees", voting: "People's Choice" };

export default async function FaqPage() {
  const faqs = await getFaqs();
  const categories = [...new Set(faqs.map((f) => f.category))];
  const approved = faqs.filter((f) => f.approvalStatus === "approved");
  return (
    <>
      {approved.length > 0 && (
        <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: approved.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) }} />
      )}
      <PageHero eyebrow="FAQ" title={<>Frequently asked <em className="text-gold-gradient">questions</em>.</>} intro="Answers marked as draft are pending organiser approval and may change." />
      <Section tone="ivory">
        <div className="grid gap-12 lg:grid-cols-[14rem_1fr]">
          <nav aria-label="FAQ categories" className="lg:sticky lg:top-28 lg:self-start">
            <ul className="flex flex-wrap gap-2 lg:flex-col">
              {categories.map((cat) => (
                <li key={cat}><a href={`#faq-${cat}`} className="inline-block rounded-full border border-espresso/15 px-4 py-2 text-xs uppercase tracking-[0.14em] text-espresso hover:border-gold-deep hover:text-gold-ink">{CATEGORY_LABELS[cat] ?? cat}</a></li>
              ))}
            </ul>
          </nav>
          <div className="space-y-16">
            {categories.map((cat) => (
              <section key={cat} aria-labelledby={`faq-${cat}`} className="scroll-mt-28">
                <p className="eyebrow mb-3">{String(categories.indexOf(cat) + 1).padStart(2, "0")}</p>
                <h2 id={`faq-${cat}`} className="mb-6 text-3xl text-espresso sm:text-4xl">{CATEGORY_LABELS[cat] ?? cat}</h2>
                <FaqList faqs={faqs.filter((f) => f.category === cat)} />
              </section>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
