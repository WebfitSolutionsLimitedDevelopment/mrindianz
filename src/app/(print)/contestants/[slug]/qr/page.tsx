/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContestantBySlug } from "@/lib/contestants/repo";
import { appEnv } from "@/lib/env";
import { contestantPath, qrBaseUrl } from "@/lib/site";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Printable QR code", robots: { index: false } };

export default async function PrintQr({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getContestantBySlug(slug);
  if (!c) notFound();
  const url = `${qrBaseUrl(appEnv() === "production")}${contestantPath(c.slug)}`;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-12 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em]">Mr. IndiaNZ 2027 · People&apos;s Choice</p>
      <h1 className="mt-4 font-display text-5xl text-black">{c.name}</h1>
      {c.number !== null && <p className="mt-1 text-lg">Contestant {String(c.number).padStart(2, "0")}</p>}
      <img src={`/api/qr/${c.slug}?format=svg`} alt={`QR code for ${url}`} className="mt-8 h-auto w-80" />
      <p className="mt-4 break-all font-mono text-sm">{url.replace(/^https:\/\//, "")}</p>
      <p className="mt-2 text-sm">Scan to view my profile and support me</p>
      <PrintButton />
    </div>
  );
}
