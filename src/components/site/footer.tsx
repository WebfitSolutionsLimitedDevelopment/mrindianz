import Link from "next/link";
import { Logo } from "./logo";
import type { SiteSettings } from "@/lib/content/defaults";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const { event, contact } = settings;
  const socials = Object.entries(contact.socials).filter(([, v]) => !!v) as [string, string][];
  return (
    <footer className="border-t border-line bg-ink text-ivory">
      <div className="container-x grid gap-12 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo variant="colour" className="h-auto w-[200px]" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-mist">{event.shortDescription}</p>
          <p className="mt-4 text-sm text-mist">
            Grand Finale: {event.finaleDisplay}
            <br />
            {event.venueName}, {event.venueAddress}
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="eyebrow mb-4 font-sans">Explore</h2>
          <ul className="space-y-2 text-sm">
            {[
              ["/about", "About"], ["/competition", "Competition"], ["/apply", "Apply"], ["/contestants", "Contestants"],
              ["/peoples-choice", "People's Choice"], ["/tickets", "Tickets"], ["/partners", "Partners"], ["/faq", "FAQ"], ["/contact", "Contact"],
            ].map(([href, label]) => (
              <li key={href}><Link className="text-ivory/80 hover:text-gold" href={href}>{label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="eyebrow mb-4 font-sans">Information</h2>
          <ul className="space-y-2 text-sm">
            {[["/privacy", "Privacy statement"], ["/terms", "Website terms"], ["/contestant-terms", "Contestant terms"], ["/voting-rules", "Voting rules"]].map(([href, label]) => (
              <li key={href}><Link className="text-ivory/80 hover:text-gold" href={href}>{label}</Link></li>
            ))}
          </ul>
          {(contact.email || socials.length > 0) && (
            <div className="mt-6 space-y-2 text-sm">
              {contact.email && <p><a className="text-ivory/80 hover:text-gold" href={`mailto:${contact.email}`}>{contact.email}</a></p>}
              {socials.length > 0 && (
                <ul className="flex flex-wrap gap-4">
                  {socials.map(([k, v]) => (
                    <li key={k}><a className="capitalize text-ivory/80 hover:text-gold" href={v} rel="noopener noreferrer" target="_blank">{k}</a></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-line/60">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-mist sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {event.organiser}. All rights reserved.</p>
          <p>Accessibility: we aim to meet WCAG 2.2 AA. <Link href="/contact" className="underline hover:text-gold">Report an issue</Link>.</p>
        </div>
      </div>
    </footer>
  );
}
