"use client";
import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareTools({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="secondary" size="sm" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* clipboard blocked */ }
      }}>
        <Copy className="h-4 w-4" aria-hidden /> {copied ? "Link copied" : "Copy link"}
      </Button>
      {canShare && (
        <Button type="button" variant="secondary" size="sm" onClick={() => navigator.share({ title, url }).catch(() => undefined)}>
          <Share2 className="h-4 w-4" aria-hidden /> Share
        </Button>
      )}
      <span className="sr-only" aria-live="polite">{copied ? "Link copied to clipboard" : ""}</span>
    </div>
  );
}
