import type { MetadataRoute } from "next";
import { getPublishedContestants } from "@/lib/contestants/repo";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticRoutes = ["", "/about", "/competition", "/apply", "/contestants", "/peoples-choice", "/tickets", "/partners", "/faq", "/contact", "/privacy", "/terms", "/contestant-terms", "/voting-rules"];
  const contestants = await getPublishedContestants();
  return [
    ...staticRoutes.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...contestants.map((c) => ({ url: `${base}/contestants/${c.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
