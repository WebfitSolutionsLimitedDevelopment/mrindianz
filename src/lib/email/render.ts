import { siteUrl } from "@/lib/site";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function fillTemplate(template: string, vars: Record<string, string | number | null | undefined>, escape: boolean): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => {
    const v = k === "site_url" ? siteUrl() : vars[k];
    const s = v === null || v === undefined ? "" : String(v);
    return escape ? escapeHtml(s) : s;
  });
}

/** Branded HTML wrapper. Uses the hosted logo; no tracking pixels. */
export function renderEmail(subjectTpl: string, bodyTpl: string, vars: Record<string, string | number | null | undefined>) {
  const subject = fillTemplate(subjectTpl, vars, false).replace(/[\r\n]+/g, " ").slice(0, 200);
  const text = fillTemplate(bodyTpl, vars, false);
  const bodyHtml = fillTemplate(bodyTpl, vars, true)
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#0b0b0c;font-family:Helvetica,Arial,sans-serif;color:#1b1b1d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0c;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:16px 24px 24px;text-align:center"><img src="${siteUrl()}/brand/logo-colour-600.png" width="260" alt="Mr. IndiaNZ" style="display:inline-block;max-width:100%;height:auto"></td></tr>
<tr><td style="background:#fef9ee;border-top:2px solid #f2b233;padding:32px 28px;font-size:15px">${bodyHtml}</td></tr>
<tr><td style="padding:20px 24px;color:#c9c2b2;font-size:12px;text-align:center">Mr. IndiaNZ 2027 · Presented by Rhythm House Events &amp; Films<br><a href="${siteUrl()}" style="color:#f2b233">${escapeHtml(siteUrl().replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
