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

export interface HeaderCta { open: boolean; label: string }

export function SiteHeader({ cta, offsetTop = 0 }: { cta: HeaderCta; offsetTop?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
  const solid = scrolled || open;

  return (
    <header
      style={{ top: offsetTop }}
      className={cn(
        "fixed inset-x-0 z-40 transition-[background-color,box-shadow,border-color] duration-500",
        solid ? "border-b border-white/10 bg-ink/92 shadow-[0_10px_30px_-15px_rgba(0,0,0,.8)] backdrop-blur-md" : "border-b border-transparent bg-gradient-to-b from-black/60 to-transparent",
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <div className={cn("container-x flex items-center justify-between gap-6 transition-[height] duration-500", solid ? "h-16 lg:h-[72px]" : "h-20 lg:h-24")}>
        <Link href="/" className="shrink-0" aria-label="Mr. IndiaNZ home">
          <Logo priority className={cn("h-auto transition-[width] duration-500", solid ? "w-[136px] sm:w-[160px]" : "w-[150px] sm:w-[190px]")} />
        </Link>

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-5 2xl:gap-7">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "relative whitespace-nowrap py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white/85 transition-colors hover:text-gold-bright",
                    "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-gold after:transition-transform hover:after:scale-x-100",
                    isActive(item.href) && "text-gold-bright after:scale-x-100",
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
            <Link href="/apply" className={buttonClasses("primary", "sm", "hidden whitespace-nowrap sm:inline-flex")}>Apply Now</Link>
          ) : (
            <Link href="/competition" className={buttonClasses("secondary", "sm", "hidden whitespace-nowrap sm:inline-flex")}>{cta.label.replace(/^Applications /, "")}</Link>
          )}
          <button
            ref={buttonRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10 xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden className="h-6 w-6" /> : <Menu aria-hidden className="h-6 w-6" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <div id="mobile-nav" hidden={!open} className="h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-ink xl:hidden">
        <nav aria-label="Mobile" className="container-x py-8">
          <ul>
            {NAV.map((item, i) => (
              <li key={item.href} className="border-b border-white/10">
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn("flex items-baseline gap-4 py-4 font-display text-[1.7rem] text-white", isActive(item.href) && "text-gold-bright")}
                >
                  <span className="font-sans text-[10px] tracking-[0.2em] text-gold">{String(i + 1).padStart(2, "0")}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            {cta.open ? (
              <Link href="/apply" className={buttonClasses("primary", "lg", "w-full")}>Apply Now — It&apos;s Free</Link>
            ) : (
              <p className="text-center text-xs uppercase tracking-[0.2em] text-mist">{cta.label}</p>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
