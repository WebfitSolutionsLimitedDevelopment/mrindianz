"use client";
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="no-print mt-10 border border-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em]">Print</button>;
}
