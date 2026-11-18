"use client";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AdminButton, adminInput } from "@/components/admin/ui";

export function PasswordForm() {
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  return (
    <form className="max-w-sm space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const pw = String(fd.get("password"));
      if (pw.length < 12) return setMsg({ error: "Use at least 12 characters." });
      if (pw !== String(fd.get("confirm"))) return setMsg({ error: "Passwords do not match." });
      const sb = createBrowserSupabase();
      const { error } = (await sb?.auth.updateUser({ password: pw })) ?? { error: new Error("Not configured") };
      setMsg(error ? { error: "Could not update password." } : { ok: "Password updated." });
    }}>
      {msg.error && <p role="alert" className="text-sm text-danger">{msg.error}</p>}
      {msg.ok && <p role="status" className="text-sm text-success">{msg.ok}</p>}
      <label className="block space-y-1"><span className="text-xs text-mist">New password</span><input name="password" type="password" autoComplete="new-password" minLength={12} required className={adminInput} /></label>
      <label className="block space-y-1"><span className="text-xs text-mist">Confirm</span><input name="confirm" type="password" autoComplete="new-password" minLength={12} required className={adminInput} /></label>
      <AdminButton type="submit">Set password</AdminButton>
    </form>
  );
}
