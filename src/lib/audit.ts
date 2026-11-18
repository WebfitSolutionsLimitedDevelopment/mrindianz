import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/** Application-level audit entry (in addition to database triggers). Never pass personal data in details. */
export async function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  const db = createServiceClient();
  if (!db) return;
  await db.from("audit_logs").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, details });
}
