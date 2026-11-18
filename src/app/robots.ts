import type { MetadataRoute } from "next";
import { siteUrl, PRODUCTION_SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const isCanonical = siteUrl() === PRODUCTION_SITE_URL && process.env.VERCEL_ENV !== "preview";
  if (!isCanonical) return { rules: [{ userAgent: "*", disallow: "/" }] }; // never index staging/preview
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/apply/success", "/peoples-choice/thank-you"] }],
    sitemap: `${PRODUCTION_SITE_URL}/sitemap.xml`,
    host: PRODUCTION_SITE_URL,
  };
}
