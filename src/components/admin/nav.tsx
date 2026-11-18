"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface AdminNavItem { href: string; label: string }

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <>
      <button type="button" className="mb-4 inline-flex items-center gap-2 text-sm lg:hidden" aria-expanded={open} aria-controls="admin-nav" onClick={() => setOpen(!open)}>
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />} Menu
      </button>
      <nav id="admin-nav" aria-label="Admin" className={cn("lg:block", open ? "block" : "hidden")}>
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={active(i.href) ? "page" : undefined}
                className={cn("block rounded px-3 py-2 text-sm", active(i.href) ? "bg-gold/10 text-gold" : "text-ivory/80 hover:bg-charcoal-2 hover:text-ivory")}
                onClick={() => setOpen(false)}>
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
