export const ADMIN_ROLES = ["super_admin", "organiser_admin", "content_editor", "application_reviewer", "finance_viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  organiser_admin: "Organiser Admin",
  content_editor: "Content Editor",
  application_reviewer: "Application Reviewer",
  finance_viewer: "Finance Viewer",
};

export type Permission =
  | "applications:read" | "applications:update" | "applications:export" | "applications:delete"
  | "contestants:read" | "contestants:write"
  | "voting:configure" | "finance:read"
  | "content:write" | "settings:write" | "email:read" | "email:write"
  | "contact:read" | "audit:read" | "users:manage";

/** Least-privilege matrix. Mirrors the database RLS policies (which are the real enforcement). */
const MATRIX: Record<Permission, AdminRole[]> = {
  "applications:read": ["organiser_admin", "application_reviewer"],
  "applications:update": ["organiser_admin", "application_reviewer"],
  "applications:export": ["organiser_admin", "application_reviewer"],
  "applications:delete": [],
  "contestants:read": ["organiser_admin", "content_editor", "application_reviewer", "finance_viewer"],
  "contestants:write": ["organiser_admin", "content_editor"],
  "voting:configure": ["organiser_admin"],
  "finance:read": ["organiser_admin", "finance_viewer"],
  "content:write": ["organiser_admin", "content_editor"],
  "settings:write": ["organiser_admin"],
  "email:read": ["organiser_admin", "content_editor", "application_reviewer"],
  "email:write": ["organiser_admin"],
  "contact:read": ["organiser_admin"],
  "audit:read": ["organiser_admin"],
  "users:manage": [],
};

export function can(roles: readonly AdminRole[], permission: Permission): boolean {
  if (roles.includes("super_admin")) return true;
  return MATRIX[permission].some((r) => roles.includes(r));
}
