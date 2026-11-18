import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/site/logo";
import { getAdminSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLogin() {
  if (await getAdminSession()) redirect("/admin");
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm rounded border border-line bg-charcoal p-8">
        <Logo className="mx-auto mb-6 h-auto w-48" />
        <h1 className="mb-6 text-center font-display text-3xl">Administration</h1>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-mist">Access is restricted to authorised organiser staff. Activity is logged.</p>
      </div>
    </main>
  );
}
