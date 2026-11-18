import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createServiceClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security";
import { EXT_FOR_TYPE, MAX_IMAGE_BYTES } from "@/lib/validation/registration";

const schema = z.object({
  folder: z.enum(["contestants", "partners", "site"]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES),
});

/** Signed upload URL into the PUBLIC media bucket — editors only. */
export async function POST(req: Request) {
  if (!(await isSameOrigin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const session = await getAdminSession();
  if (!session || !(can(session.roles, "content:write") || can(session.roles, "contestants:write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid file" }, { status: 400 });
  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  const path = `${parsed.data.folder}/${crypto.randomUUID()}.${EXT_FOR_TYPE[parsed.data.contentType]}`;
  const { data, error } = await db.storage.from("public-media").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "Could not prepare upload" }, { status: 502 });
  return NextResponse.json({ path: data.path, token: data.token });
}
