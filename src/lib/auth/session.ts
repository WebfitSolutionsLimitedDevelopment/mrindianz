import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { ADMIN_ROLES, can, type AdminRole, type Permission } from "./roles";

export interface AdminSession {
  userId: string;
  email: string;
  roles: AdminRole[];
}

/** Returns the signed-in admin (validated with Supabase Auth on every request) or null. */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  if (!supabasePublicConfig()) return null;
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: roles } = await supabase.from("admin_roles").select("role").eq("user_id", user.id);
  const valid = (roles ?? []).map((r) => r.role as AdminRole).filter((r) => ADMIN_ROLES.includes(r));
  if (valid.length === 0) return null;
  return { userId: user.id, email: user.email ?? "", roles: valid };
});

/** Server-side authorisation guard for admin pages and server actions. */
export async function requirePermission(permission: Permission): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!can(session.roles, permission)) redirect("/admin?denied=1");
  return session;
}

export async function assertPermission(permission: Permission): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session || !can(session.roles, permission)) throw new Error("Forbidden");
  return session;
}
