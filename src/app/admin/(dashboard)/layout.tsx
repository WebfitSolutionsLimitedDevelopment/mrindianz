import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { can, ROLE_LABELS, type Permission } from "@/lib/auth/roles";
import { AdminNav } from "@/components/admin/nav";
import { Logo } from "@/components/site/logo";
import { appEnv } from "@/lib/env";
import { signOut } from "./actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; perm?: Permission }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/applications", label: "Applications", perm: "applications:read" },
  { href: "/admin/contestants", label: "Contestants", perm: "contestants:read" },
  { href: "/admin/voting", label: "Voting", perm: "voting:configure" },
  { href: "/admin/transactions", label: "Transactions", perm: "finance:read" },
  { href: "/admin/content", label: "Content", perm: "content:write" },
  { href: "/admin/media", label: "Media", perm: "content:write" },
  { href: "/admin/partners", label: "Partners", perm: "content:write" },
  { href: "/admin/faqs", label: "FAQs", perm: "content:write" },
  { href: "/admin/messages", label: "Enquiries", perm: "contact:read" },
  { href: "/admin/email", label: "Email", perm: "email:read" },
  { href: "/admin/settings", label: "Settings", perm: "settings:write" },
  { href: "/admin/users", label: "Users & roles", perm: "users:manage" },
  { href: "/admin/audit", label: "Audit log", perm: "audit:read" },
  { href: "/admin/account", label: "My account" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const items = NAV.filter((n) => !n.perm || can(session.roles, n.perm)).map(({ href, label }) => ({ href, label }));
  const env = appEnv();
  return (
    <div className="min-h-dvh bg-ink text-ivory">
      {env !== "production" && <div className="bg-gold px-4 py-1 text-center text-xs font-semibold text-ink">{env.toUpperCase()} — test data only</div>}
      <header className="border-b border-line">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/admin" aria-label="Admin home"><Logo className="h-auto w-36" /></Link>
          <div className="flex items-center gap-4 text-xs text-mist">
            <span className="hidden sm:inline">{session.email} · {session.roles.map((r) => ROLE_LABELS[r]).join(", ")}</span>
            <Link href="/" className="hover:text-gold">View site</Link>
            <form action={signOut}><button type="submit" className="hover:text-gold">Sign out</button></form>
          </div>
        </div>
      </header>
      <div className="grid lg:grid-cols-[220px_1fr]">
        <aside className="border-b border-line p-4 lg:min-h-[calc(100dvh-57px)] lg:border-b-0 lg:border-r">
          <AdminNav items={items} />
        </aside>
        <main id="main" className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
