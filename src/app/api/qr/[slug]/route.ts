import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { getContestantBySlug } from "@/lib/contestants/repo";
import { appEnv } from "@/lib/env";
import { contestantPath, qrBaseUrl } from "@/lib/site";

export const runtime = "nodejs";

/**
 * QR code for a published contestant's permanent profile URL. Encodes ONLY the public profile URL.
 * In production the canonical domain is always used, never the request host.
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const contestant = await getContestantBySlug(slug);
  if (!contestant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = `${qrBaseUrl(appEnv() === "production")}${contestantPath(contestant.slug)}`;
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") === "png" ? "png" : "svg";
  const download = sp.get("download") === "1";
  const filename = `mr-indianz-${contestant.slug}-qr.${format}`;
  const headers: Record<string, string> = {
    "Cache-Control": "public, max-age=3600",
    ...(download ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
  };
  const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#0b0b0cff", light: "#ffffffff" } };

  if (format === "png") {
    const buf = await QRCode.toBuffer(url, { ...opts, type: "png", width: 1024 });
    return new NextResponse(new Uint8Array(buf), { headers: { ...headers, "Content-Type": "image/png" } });
  }
  const svg = await QRCode.toString(url, { ...opts, type: "svg" });
  return new NextResponse(svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
