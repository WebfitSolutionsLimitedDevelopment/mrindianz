"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AdminButton, adminInput } from "@/components/admin/ui";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [message, setMessage] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);
  const supabase = createBrowserSupabase();

  if (!supabase) return <p className="text-danger">Supabase is not configured for this environment.</p>;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    setBusy(true);
    setMessage({});
    if (mode === "login") {
      const { error } = await supabase!.auth.signInWithPassword({ email, password: String(fd.get("password") ?? "") });
      setBusy(false);
      if (error) return setMessage({ error: "Sign-in failed. Check your email and password." });
      router.replace("/admin");
      router.refresh();
    } else {
      await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin/auth/callback?next=/admin/account` });
      setBusy(false);
      setMessage({ ok: "If that email belongs to an administrator, a reset link has been sent." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {message.error && <p role="alert" className="text-sm text-danger">{message.error}</p>}
      {message.ok && <p role="status" className="text-sm text-success">{message.ok}</p>}
      <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-[0.1em] text-mist">Email</span>
        <input name="email" type="email" required autoComplete="username" className={adminInput} /></label>
      {mode === "login" && (
        <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-[0.1em] text-mist">Password</span>
          <input name="password" type="password" required autoComplete="current-password" className={adminInput} /></label>
      )}
      <AdminButton type="submit" disabled={busy} className="w-full">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Send reset link"}</AdminButton>
      <button type="button" className="w-full text-center text-xs text-mist underline" onClick={() => { setMode(mode === "login" ? "reset" : "login"); setMessage({}); }}>
        {mode === "login" ? "Forgot password?" : "Back to sign in"}
      </button>
    </form>
  );
}
