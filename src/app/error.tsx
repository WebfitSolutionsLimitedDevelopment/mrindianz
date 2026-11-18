"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-ink px-6 text-center text-ivory">
      <h1 className="font-display text-5xl">Something went wrong</h1>
      <p className="mt-4 text-mist">Please try again. If the problem continues, contact us.</p>
      <button type="button" onClick={reset} className="mt-8 border border-gold px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold hover:bg-gold hover:text-ink">Try again</button>
    </main>
  );
}
