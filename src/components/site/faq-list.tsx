import { Plus } from "lucide-react";
import type { Faq } from "@/lib/content/repo";
import { PendingApproval } from "@/components/ui/badge";

export function FaqList({ faqs }: { faqs: Faq[]; light?: boolean }) {
  return (
    <div className="space-y-3">
      {faqs.map((f) => (
        <details key={f.id} className="group card overflow-hidden px-6 open:shadow-[0_18px_40px_-18px_rgba(42,33,23,.35)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
            <span className="font-display text-lg text-espresso sm:text-xl">{f.question}</span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold-ink transition group-open:rotate-45 group-open:bg-ink group-open:text-gold">
              <Plus aria-hidden className="h-4 w-4" />
            </span>
          </summary>
          <div className="pb-6 pr-12">
            {f.approvalStatus === "pending_approval" && <div className="mb-3"><PendingApproval label="Draft answer — pending approval" /></div>}
            <p className="leading-relaxed text-stone">{f.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
