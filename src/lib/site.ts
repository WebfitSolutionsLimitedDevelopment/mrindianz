/**
 * Central site URL configuration. Safe to import from client and server code.
 * Production canonical host: https://www.mrindianz.co.nz (set NEXT_PUBLIC_SITE_URL).
 */
export const PRODUCTION_SITE_URL = "https://www.mrindianz.co.nz";

export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}

export function absoluteUrl(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * URL to encode in printed QR codes. In production this is ALWAYS the canonical domain,
 * so QR codes can never point at localhost or a staging deployment by accident.
 */
export function qrBaseUrl(isProductionEnv: boolean): string {
  if (isProductionEnv) return PRODUCTION_SITE_URL;
  return siteUrl();
}

export function contestantPath(slug: string) {
  return `/contestants/${encodeURIComponent(slug)}`;
}

export const SITE_NAME = "Mr. IndiaNZ 2027";
