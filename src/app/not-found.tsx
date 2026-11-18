import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-ink px-6 text-center text-ivory">
      <div aria-hidden className="rule-gold mb-10 w-24" />
      <h1 className="font-display text-5xl">Page not found</h1>
      <p className="mt-4 text-mist">The page you&apos;re looking for doesn&apos;t exist or is no longer published.</p>
      <Link href="/" className="mt-8 border border-gold px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold hover:bg-gold hover:text-ink">Back to home</Link>
    </main>
  );
}
