import "server-only";
import { appEnv, serverEnv } from "@/lib/env";
import { getSettings } from "@/lib/content/repo";
import { registrationState } from "@/lib/registration-state";

export async function getRegistrationState() {
  const settings = await getSettings();
  const env = serverEnv();
  return registrationState(settings, {
    enabledFlag: env.REGISTRATION_ENABLED,
    allowUnapproved: env.ALLOW_UNAPPROVED_POLICIES && appEnv() !== "production",
  });
}

export function ctaForState(s: Awaited<ReturnType<typeof getRegistrationState>>) {
  switch (s.state) {
    case "open": return { open: true, label: "Apply Now" };
    case "closed": return { open: false, label: "Applications closed" };
    case "not_yet_open": return { open: false, label: "Applications open soon" };
    default: return { open: false, label: "Applications opening soon" };
  }
}
