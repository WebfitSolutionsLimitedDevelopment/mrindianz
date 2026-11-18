import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/ui/section";
import { FaqList } from "@/components/site/faq-list";
import { JsonLd } from "@/components/site/json-ld";
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
        <JsonLd data={{
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: approved.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
        }} />
      )}
      <Section tone="dark" className="border-b border-line">
        <SectionHeading as="h1" eyebrow="FAQ" title="Frequently asked questions" intro="Answers marked as draft are pending organiser approval and may change." />
      </Section>
      <Section tone="light">
        <div className="space-y-14">
          {categories.map((cat) => (
            <section key={cat} aria-labelledby={`faq-${cat}`}>
              <h2 id={`faq-${cat}`} className="mb-4 text-3xl">{CATEGORY_LABELS[cat] ?? cat}</h2>
              <FaqList light faqs={faqs.filter((f) => f.category === cat)} />
            </section>
          ))}
        </div>
      </Section>
    </>
  );
}
