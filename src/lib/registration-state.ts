import type { SiteSettings } from "@/lib/content/defaults";

export type RegistrationState =
  | { state: "open"; closesAt: string; stagingOverride: boolean }
  | { state: "not_yet_open"; opensAt: string }
  | { state: "closed" }
  | { state: "disabled" }
  | { state: "pending_approval"; missing: string[] };

/** Approvals the brief requires before registration launch. */
export function missingLaunchApprovals(s: SiteSettings): string[] {
  const missing: string[] = [];
  if (!s.registration.eligibilityApproved) missing.push("Eligibility definitions (organiser + legal)");
  if (!s.registration.agePolicyApproved) missing.push("Minimum age policy");
  if (!s.legal.approved.contestantTerms) missing.push("Contestant terms / agreement");
  if (!s.legal.approved.privacy) missing.push("Privacy statement");
  return missing;
}

/**
 * Registration is open only when: the REGISTRATION_ENABLED flag is on, required policies are approved
 * (bypassable on non-production with ALLOW_UNAPPROVED_POLICIES), and now is within the configured window.
 */
export function registrationState(
  s: SiteSettings,
  opts: { enabledFlag: boolean; allowUnapproved: boolean; now?: Date },
): RegistrationState {
  if (!opts.enabledFlag) return { state: "disabled" };
  const missing = missingLaunchApprovals(s);
  if (missing.length && !opts.allowUnapproved) return { state: "pending_approval", missing };
  const now = (opts.now ?? new Date()).getTime();
  const opens = Date.parse(s.registration.opensAt);
  const closes = Date.parse(s.registration.closesAt);
  if (!opts.allowUnapproved && Number.isFinite(opens) && now < opens) return { state: "not_yet_open", opensAt: s.registration.opensAt };
  if (Number.isFinite(closes) && now >= closes) return { state: "closed" };
  return { state: "open", closesAt: s.registration.closesAt, stagingOverride: missing.length > 0 || (Number.isFinite(opens) && now < opens) };
}
