"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AdminButton } from "./ui";

/** Uploads to the public-media bucket via a signed URL and writes the storage path into a hidden input. */
export function ImageUpload({ name, folder, initialPath, initialUrl, label }: {
  name: string; folder: "contestants" | "partners" | "site"; initialPath?: string | null; initialUrl?: string | null; label: string;
}) {
  const [path, setPath] = useState(initialPath ?? "");
  const [preview, setPreview] = useState(initialUrl ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function onFile(f: File) {
    setMsg(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setMsg("Use JPG, PNG or WEBP.");
    if (f.size > 5 * 1024 * 1024) return setMsg("Maximum 5 MB.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder, contentType: f.type, size: f.size }) });
      const body = (await res.json()) as { path?: string; token?: string; error?: string };
      if (!res.ok || !body.path || !body.token) throw new Error(body.error ?? "Upload failed");
      const sb = createBrowserSupabase();
      if (!sb) throw new Error("Storage not configured");
      const { error } = await sb.storage.from("mrindianz-public").uploadToSignedUrl(body.path, body.token, f, { contentType: f.type });
      if (error) throw new Error("Upload failed — retry");
      setPath(body.path);
      setPreview(URL.createObjectURL(f));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-mist">{label}</span>
      <input type="hidden" name={name} value={path} />
      <div className="flex items-start gap-4">
        <div className="h-32 w-28 shrink-0 overflow-hidden rounded border border-line bg-charcoal-2">
          {preview ? <img src={preview} alt="Selected image preview" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-mist">No image</span>}
        </div>
        <div className="space-y-2">
          <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={label} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
          <AdminButton type="button" variant="secondary" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Uploading…" : path ? "Replace image" : "Upload image"}</AdminButton>
          {path && <AdminButton type="button" variant="secondary" onClick={() => { setPath(""); setPreview(""); }}>Remove</AdminButton>}
          {msg && <p role="alert" className="text-xs text-danger">{msg}</p>}
          <p className="text-xs text-mist">Only upload approved photography. No AI-generated portraits.</p>
        </div>
      </div>
    </div>
  );
}
