import type { ReactNode } from "react";
import { KoruMark } from "@/components/site/stage";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card relative overflow-hidden px-6 py-16 text-center sm:px-16">
      <KoruMark className="mx-auto mb-8 w-20 opacity-90" />
      <h2 className="text-3xl text-espresso sm:text-4xl">{title}</h2>
      {children && <div className="mx-auto mt-4 max-w-xl text-stone">{children}</div>}
      {action && <div className="mt-9">{action}</div>}
    </div>
  );
}
