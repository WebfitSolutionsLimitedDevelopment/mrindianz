import "server-only";
import { redirect } from "next/navigation";

export function back(path: string, msg: { ok?: string; error?: string }): never {
  const u = new URL(path, "http://x");
  if (msg.ok) u.searchParams.set("ok", msg.ok);
  if (msg.error) u.searchParams.set("error", msg.error);
  redirect(`${u.pathname}${u.search}`);
}

export function firstIssue(e: { issues: { message: string; path: PropertyKey[] }[] }) {
  const i = e.issues[0];
  return i ? `${i.path.map(String).join(".") ? `${i.path.map(String).join(".")}: ` : ""}${i.message}` : "Invalid input";
}
