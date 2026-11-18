import Link from "next/link";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { getSettings } from "@/lib/content/repo";
import { ctaForState, getRegistrationState } from "@/lib/registration";
import { appEnv } from "@/lib/env";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, reg] = await Promise.all([getSettings(), getRegistrationState()]);
  const env = appEnv();
  return (
    <>
      {env !== "production" && (
        <div className="bg-gold px-4 py-1.5 text-center text-xs font-semibold text-ink" role="note">
          {env === "staging" ? "STAGING" : "DEVELOPMENT"} environment — not the live website. No real payments are taken.
        </div>
      )}
      {settings.announcement.enabled && settings.announcement.text && (
        <div className="border-b border-gold/30 bg-charcoal px-4 py-2 text-center text-sm text-ivory">
          {settings.announcement.href ? (
            <Link href={settings.announcement.href} className="underline decoration-gold underline-offset-4 hover:text-gold">{settings.announcement.text}</Link>
          ) : settings.announcement.text}
        </div>
      )}
      <SiteHeader cta={ctaForState(reg)} />
      <main id="main" tabIndex={-1} className="outline-none">{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
