import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createUserClient } from "@/lib/supabase/server";
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/validation/admin";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session || !can(session.roles, "applications:export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const db = await createUserClient();
  let q = db.from("applications").select("reference, status, submitted_at, legal_name, stage_name, date_of_birth, email, mobile, city, region, occupation, instagram, talent_audition, talent_description, has_experience, video_url, marketing_opt_in").is("anonymised_at", null).order("submitted_at");
  const status = sp.get("status");
  if (status && APPLICATION_STATUSES.includes(status as ApplicationStatus)) q = q.eq("status", status);
  if (sp.get("talent") === "1") q = q.eq("talent_audition", true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
  const header = ["Reference", "Status", "Submitted", "Legal name", "Stage name", "Date of birth", "Email", "Mobile", "City", "Region", "Occupation", "Instagram", "Mr. Talent", "Talent description", "Experience", "Video URL", "Marketing opt-in"];
  const rows = (data ?? []).map((a) => [a.reference, STATUS_LABELS[a.status as ApplicationStatus], a.submitted_at, a.legal_name, a.stage_name, a.date_of_birth, a.email, a.mobile, a.city, a.region, a.occupation, a.instagram, a.talent_audition ? "Yes" : "No", a.talent_description, a.has_experience ? "Yes" : "No", a.video_url, a.marketing_opt_in ? "Yes" : "No"]);
  const csv = toCsv([header, ...rows]);
  await audit(session.userId, "applications_exported", "applications", null, { count: rows.length, status: status ?? "all" });
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="mr-indianz-applications-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
