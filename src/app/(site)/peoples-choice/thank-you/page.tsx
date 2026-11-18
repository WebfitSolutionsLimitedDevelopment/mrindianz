import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { PageHero } from "@/components/site/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { createServiceClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thank you for your support", robots: { index: false, follow: false } };

/**
 * Shown after Stripe redirects back. This page NEVER credits votes — it only reports the status
 * recorded by the verified webhook.
 */
export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  type OrderView = { public_ref: string; status: string; total_votes: number; total_cents: number; contestants: { public_name: string; slug: string } | null };
  let order = null as OrderView | null;
  if (session_id && /^cs_(test|live)_[A-Za-z0-9]+$/.test(session_id)) {
    const db = createServiceClient();
    const { data } = db
      ? await db.from("voting_orders").select("public_ref, status, total_votes, total_cents, contestants(public_name, slug)").eq("stripe_checkout_session_id", session_id).maybeSingle()
      : { data: null };
    order = (data as unknown as OrderView | null) ?? null;
  }
  const paid = order?.status === "paid";
  return (
    <>
    <PageHero eyebrow="People's Choice" title={<>Thank you for your <em className="text-gold-gradient">support</em>.</>} />
    <Section tone="cream">
      <div className="card mx-auto max-w-2xl p-8 sm:p-12" role="status">
        {order ? (
          <>
            <p className="text-lg text-espresso">
              {paid
                ? <>Your payment has been verified and <strong>{order.total_votes.toLocaleString("en-NZ")} votes</strong> have been credited to {order.contestants?.public_name}.</>
                : <>We&apos;re confirming your payment. Your {order.total_votes.toLocaleString("en-NZ")} votes for {order.contestants?.public_name} will be credited as soon as the payment is verified — usually within a minute.</>}
            </p>
            <dl className="mt-8 grid gap-4 rounded-2xl bg-ink p-6 text-ivory sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-[0.14em] text-mist">Order reference</dt><dd className="mt-1 font-mono text-gold">{order.public_ref}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.14em] text-mist">Amount</dt><dd className="mt-1">{formatCents(order.total_cents)}</dd></div>
            </dl>
            {order.contestants && <div className="mt-8"><ButtonLink href={`/contestants/${order.contestants.slug}`} variant="outline">Back to {order.contestants.public_name}</ButtonLink></div>}
          </>
        ) : (
          <p className="text-stone">If you completed a payment, your votes will be credited once the payment is verified. A receipt will be emailed to you.</p>
        )}
        <div className="mt-6"><ButtonLink href="/peoples-choice" variant="ghost">View the leaderboard</ButtonLink></div>
      </div>
    </Section>
    </>
  );
}
