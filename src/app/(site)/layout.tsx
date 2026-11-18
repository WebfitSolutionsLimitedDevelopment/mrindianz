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
        <div className="fixed inset-x-0 bottom-0 z-50 bg-gold px-4 py-1 text-center text-[11px] font-semibold text-ink" role="note">
          {env === "staging" ? "STAGING" : "DEVELOPMENT"} — not the live website. No real payments are taken.
        </div>
      )}
      {settings.announcement.enabled && settings.announcement.text && (
        <div className="fixed inset-x-0 top-0 z-50 flex h-9 items-center justify-center bg-gold px-4 text-center text-xs font-medium text-ink sm:text-sm">
          {settings.announcement.href ? (
            <Link href={settings.announcement.href} className="underline underline-offset-4">{settings.announcement.text}</Link>
          ) : settings.announcement.text}
        </div>
      )}
      <SiteHeader cta={ctaForState(reg)} offsetTop={settings.announcement.enabled && settings.announcement.text ? 36 : 0} />
      <main id="main" tabIndex={-1} className="outline-none">{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
