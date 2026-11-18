import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME} | Celebrating Kiwi-Indian Style, Culture and Charisma`, template: `%s | ${SITE_NAME}` },
  description: "The inaugural Mr. IndiaNZ pageant — Grand Finale Saturday 3 April 2027 at The Cloud, Auckland. Applications are free.",
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "en_NZ",
    siteName: SITE_NAME,
    images: [{ url: "/brand/og-default.jpg", width: 1200, height: 630, alt: "Mr. IndiaNZ" }],
  },
  twitter: { card: "summary_large_image", images: ["/brand/og-default.jpg"] },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NZ">
      <head>
        <link rel="preload" href="/fonts/manrope-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/cormorant-garamond-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
