import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createUserClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { audit } from "@/lib/audit";

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session || !can(session.roles, "finance:read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const mode = new URL(req.url).searchParams.get("mode");
  const db = await createUserClient();
  const { data, error } = await db.from("voting_orders")
    .select("public_ref, status, payment_mode, created_at, paid_at, total_cents, total_votes, supporter_name, display_anonymously, stripe_payment_intent_id, contestants(public_name), voting_order_items(package_name, quantity, unit_price_cents)")
    .eq("payment_mode", ["live", "test", "demo"].includes(mode ?? "") ? mode! : "live").order("created_at");
  if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
  const rows = (data ?? []).map((o) => {
    const item = (o.voting_order_items as unknown as { package_name: string; quantity: number; unit_price_cents: number }[])[0];
    return [o.public_ref, o.status, o.payment_mode, o.created_at, o.paid_at, (o.contestants as unknown as { public_name: string } | null)?.public_name, item?.package_name, item?.quantity,
      (item?.unit_price_cents ?? 0) / 100, o.total_cents / 100, o.total_votes, o.supporter_name, o.display_anonymously ? "Yes" : "No", o.stripe_payment_intent_id];
  });
  await audit(session.userId, "transactions_exported", "voting_orders", null, { count: rows.length, mode });
  return new NextResponse(toCsv([["Order ref", "Status", "Mode", "Created", "Paid", "Contestant", "Package", "Qty", "Unit price NZD", "Total NZD", "Votes", "Supporter", "Anonymous", "Stripe PaymentIntent"], ...rows]), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="mr-indianz-transactions-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
