"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/competition", label: "Competition" },
  { href: "/contestants", label: "Contestants" },
  { href: "/peoples-choice", label: "People's Choice" },
  { href: "/partners", label: "Partners" },
  { href: "/tickets", label: "Tickets" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export interface HeaderCta {
  open: boolean;
  label: string;
}

export function SiteHeader({ cta }: { cta: HeaderCta }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/80">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-gold focus:px-4 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <div className="container-x flex h-16 items-center justify-between gap-4 lg:h-20">
        <Link href="/" className="shrink-0" aria-label="Mr. IndiaNZ home">
          <Logo priority className="h-auto w-[150px] sm:w-[190px]" />
        </Link>

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "text-[13px] font-medium tracking-wide text-ivory/80 transition-colors hover:text-gold",
                    isActive(item.href) && "text-gold",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          {cta.open ? (
            <Link href="/apply" className={buttonClasses("primary", "sm", "hidden sm:inline-flex")}>
              Apply Now
            </Link>
          ) : (
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-mist sm:inline">{cta.label}</span>
          )}
          <button
            ref={buttonRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center text-ivory xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden className="h-6 w-6" /> : <Menu aria-hidden className="h-6 w-6" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <div id="mobile-nav" hidden={!open} className="h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-ink xl:hidden">
        <nav aria-label="Mobile" className="container-x py-6">
          <ul className="divide-y divide-line/60">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn("block py-4 font-display text-2xl text-ivory", isActive(item.href) && "text-gold")}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {cta.open ? (
              <Link href="/apply" className={buttonClasses("primary", "lg", "w-full")}>Apply Now — Free</Link>
            ) : (
              <p className="text-sm uppercase tracking-[0.16em] text-mist">{cta.label}</p>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
