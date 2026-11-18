import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Daily housekeeping (Vercel Cron): removes abandoned draft uploads (photos uploaded but never
 * submitted) older than 24 hours from the private application bucket. Protected by CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const cutoff = Date.now() - 24 * 3600_000;
  let removed = 0;
  const { data: sessions } = await db.storage.from("mrindianz-applications").list("drafts", { limit: 1000 });
  for (const s of sessions ?? []) {
    const { data: files } = await db.storage.from("mrindianz-applications").list(`drafts/${s.name}`, { limit: 10 });
    const stale = (files ?? []).filter((f) => f.created_at && Date.parse(f.created_at) < cutoff).map((f) => `drafts/${s.name}/${f.name}`);
    if (stale.length) {
      await db.storage.from("mrindianz-applications").remove(stale);
      removed += stale.length;
    }
  }
  return NextResponse.json({ removed });
}
