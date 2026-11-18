import { ChevronDown } from "lucide-react";
import type { Faq } from "@/lib/content/repo";
import { PendingApproval } from "@/components/ui/badge";

export function FaqList({ faqs, light = false }: { faqs: Faq[]; light?: boolean }) {
  return (
    <div className={light ? "divide-y divide-ink/15 border-y border-ink/15" : "divide-y divide-line border-y border-line"}>
      {faqs.map((f) => (
        <details key={f.id} className="group py-1">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
            <span className="font-display text-xl sm:text-2xl">{f.question}</span>
            <ChevronDown aria-hidden className="mt-1 h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="pb-6 pr-10">
            {f.approvalStatus === "pending_approval" && <div className="mb-3"><PendingApproval light={light} label="Draft answer — pending approval" /></div>}
            <p className={light ? "leading-relaxed text-stone" : "leading-relaxed text-mist"}>{f.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
