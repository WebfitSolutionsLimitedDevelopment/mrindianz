import { Section, Prose } from "@/components/ui/section";
import { PendingApproval } from "@/components/ui/badge";
import { PageHero } from "./page-hero";
import type { LegalDoc } from "@/lib/content/legal";

export function LegalPage({ doc, version, approved }: { doc: LegalDoc; version: string; approved: boolean }) {
  return (
    <>
      <PageHero eyebrow="Information" title={doc.title} intro={doc.intro}>
        <div className="flex flex-wrap items-center gap-3 text-sm text-mist">
          {!approved && <PendingApproval dark label="Draft — pending organiser and legal approval" />}
          <span>Version {version}</span>
        </div>
      </PageHero>
      <Section tone="ivory">
        <div className="card mx-auto max-w-3xl space-y-10 p-8 sm:p-14">
          {doc.sections.map((s, i) => (
            <section key={s.heading}>
              <p className="eyebrow">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="mt-2 text-2xl text-espresso sm:text-3xl">{s.heading}</h2>
              <Prose text={s.body} className="mt-3 text-stone" />
            </section>
          ))}
        </div>
      </Section>
    </>
  );
}
