import Link from "next/link";
import { Logo } from "./logo";
import { KoruMark } from "./stage";
import type { SiteSettings } from "@/lib/content/defaults";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const { event, contact } = settings;
  const socials = Object.entries(contact.socials).filter(([, v]) => !!v) as [string, string][];
  return (
    <footer className="on-dark relative overflow-hidden bg-ink text-ivory">
      <KoruMark className="absolute -right-24 -top-10 w-[34rem] opacity-[0.05]" />
      <div className="container-x relative grid gap-12 py-20 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo variant="colour" className="h-auto w-[220px]" />
          <p className="mt-6 max-w-sm font-display text-xl italic leading-snug text-white/90">{event.tagline}</p>
          <p className="mt-6 text-sm leading-relaxed text-mist">
            Grand Finale · {event.finaleDisplay}
            <br />
            {event.venueName}, {event.venueAddress}
          </p>
          {(contact.email || socials.length > 0) && (
            <div className="mt-6 space-y-3 text-sm">
              {contact.email && <p><a className="text-gold hover:text-gold-bright" href={`mailto:${contact.email}`}>{contact.email}</a></p>}
              {socials.length > 0 && (
                <ul className="flex flex-wrap gap-3">
                  {socials.map(([k, v]) => (
                    <li key={k}><a className="inline-flex rounded-full border border-white/20 px-4 py-1.5 text-xs uppercase tracking-[0.14em] text-white/85 hover:border-gold hover:text-gold" href={v} rel="noopener noreferrer" target="_blank">{k}</a></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <nav aria-label="Footer">
          <h2 className="eyebrow eyebrow-dark mb-5 font-sans">Explore</h2>
          <ul className="space-y-3 text-sm">
            {[["/about", "About"], ["/competition", "Competition"], ["/apply", "Apply"], ["/contestants", "Contestants"], ["/peoples-choice", "People's Choice"], ["/tickets", "Tickets"], ["/partners", "Partners"], ["/faq", "FAQ"], ["/contact", "Contact"]].map(([href, label]) => (
              <li key={href}><Link className="text-white/75 transition hover:text-gold-bright" href={href}>{label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="eyebrow eyebrow-dark mb-5 font-sans">Information</h2>
          <ul className="space-y-3 text-sm">
            {[["/privacy", "Privacy statement"], ["/terms", "Website terms"], ["/contestant-terms", "Contestant terms"], ["/voting-rules", "Voting rules"]].map(([href, label]) => (
              <li key={href}><Link className="text-white/75 transition hover:text-gold-bright" href={href}>{label}</Link></li>
            ))}
          </ul>
          <p className="mt-8 text-xs leading-relaxed text-mist">Presented by {event.organiser} — the team behind Miss IndiaNZ and Miss India South Pacific.</p>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-mist sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {event.organiser}. All rights reserved.</p>
          <p>We aim to meet WCAG 2.2 AA. <Link href="/contact" className="underline hover:text-gold">Report an accessibility issue</Link>.</p>
        </div>
      </div>
    </footer>
  );
}
