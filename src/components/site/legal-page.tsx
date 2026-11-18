import { Section, SectionHeading, Prose } from "@/components/ui/section";
import { PendingApproval } from "@/components/ui/badge";
import type { LegalDoc } from "@/lib/content/legal";

export function LegalPage({ doc, version, approved }: { doc: LegalDoc; version: string; approved: boolean }) {
  return (
    <>
      <Section tone="dark" className="border-b border-line">
        <SectionHeading as="h1" eyebrow="Information" title={doc.title} intro={doc.intro} />
        <div className="flex flex-wrap items-center gap-3 text-sm text-mist">
          {!approved && <PendingApproval label="Draft — pending organiser and legal approval" />}
          <span>Version {version}</span>
        </div>
      </Section>
      <Section tone="light">
        <div className="mx-auto max-w-3xl space-y-10">
          {doc.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-3xl">{s.heading}</h2>
              <Prose text={s.body} className="mt-3 text-ink/85" />
            </section>
          ))}
        </div>
      </Section>
    </>
  );
}
