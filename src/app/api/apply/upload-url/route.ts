import { NextResponse } from "next/server";
import { photoMetadataSchema, EXT_FOR_TYPE } from "@/lib/validation/registration";
import { createServiceClient } from "@/lib/supabase/server";
import { isSameOrigin, rateLimit } from "@/lib/security";
import { getRegistrationState } from "@/lib/registration";

export const runtime = "nodejs";

/**
 * Issues a short-lived signed upload URL into the PRIVATE application-media bucket.
 * Files go straight from the browser to storage (avoids serverless body limits). The bucket itself
 * enforces the 5 MB limit and image MIME types; the submit action re-verifies bytes server-side.
 */
export async function POST(req: Request) {
  if (!(await isSameOrigin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const reg = await getRegistrationState();
  if (reg.state !== "open") return NextResponse.json({ error: "Applications are not open." }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = photoMetadataSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid file" }, { status: 400 });

  if (!(await rateLimit("apply-upload", 40, 3600))) {
    return NextResponse.json({ error: "Too many uploads. Please wait and try again." }, { status: 429 });
  }
  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Uploads are not available yet." }, { status: 503 });

  const { kind, contentType, uploadSessionId } = parsed.data;
  const path = `drafts/${uploadSessionId}/${kind}-${crypto.randomUUID()}.${EXT_FOR_TYPE[contentType]}`;
  const { data, error } = await db.storage.from("application-media").createSignedUploadUrl(path);
  if (error || !data) {
    console.warn(`[apply] signed upload failed: ${error?.message}`);
    return NextResponse.json({ error: "Could not prepare the upload. Please retry." }, { status: 502 });
  }
  return NextResponse.json({ path: data.path, token: data.token }, { headers: { "Cache-Control": "no-store" } });
}
