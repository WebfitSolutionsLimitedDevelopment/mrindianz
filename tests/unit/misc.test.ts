import { describe, expect, it } from "vitest";
import { formatCents, nzLocalToIso, isoToNzLocal, daysUntilNzDate } from "@/lib/format";
import { competitionRanks, effectiveVotingState } from "@/lib/voting/state";
import { registrationState } from "@/lib/registration-state";
import { DEFAULT_SETTINGS } from "@/lib/content/defaults";
import { fillTemplate, renderEmail } from "@/lib/email/render";
import { csvCell } from "@/lib/csv";
import { can } from "@/lib/auth/roles";
import { qrBaseUrl } from "@/lib/site";

describe("money", () => {
  it("formats integer cents without floating point", () => {
    expect(formatCents(400)).toBe("NZ$4.00");
    expect(formatCents(10000)).toBe("NZ$100.00");
    expect(formatCents(123456789)).toBe("NZ$1,234,567.89");
    expect(formatCents(-1050)).toBe("-NZ$10.50");
    expect(() => formatCents(1.5)).toThrow();
  });
});

describe("NZ time", () => {
  it("converts NZ local time (DST and standard) to UTC", () => {
    expect(nzLocalToIso("2027-01-31T23:59")).toBe("2027-01-31T10:59:00.000Z"); // NZDT +13
    expect(nzLocalToIso("2027-06-01T09:00")).toBe("2027-05-31T21:00:00.000Z"); // NZST +12
    expect(isoToNzLocal("2027-01-31T10:59:00.000Z")).toBe("2027-01-31T23:59");
  });
  it("counts days to an NZ date", () => {
    expect(daysUntilNzDate("2027-04-03", new Date("2027-04-02T10:00:00Z"))).toBe(1); // 23:00 on 2 April NZDT;
    expect(daysUntilNzDate("2027-04-03", new Date("2027-04-02T11:30:00Z"))).toBe(0); // already 3 April in NZ
  });
});

describe("voting state", () => {
  const now = new Date("2027-03-01T00:00:00Z");
  it("respects the configured window", () => {
    expect(effectiveVotingState({ status: "open", opens_at: "2027-03-02T00:00:00Z", closes_at: null }, now)).toBe("scheduled");
    expect(effectiveVotingState({ status: "open", opens_at: null, closes_at: "2027-02-28T00:00:00Z" }, now)).toBe("closed");
    expect(effectiveVotingState({ status: "open", opens_at: "2027-02-01T00:00:00Z", closes_at: "2027-04-01T00:00:00Z" }, now)).toBe("open");
    expect(effectiveVotingState({ status: "paused", opens_at: null, closes_at: null }, now)).toBe("paused");
  });
  it("ranks ties like SQL rank()", () => {
    expect(competitionRanks([700, 300, 300, 20, 0])).toEqual([1, 2, 2, 4, 5]);
  });
});

describe("registration launch gate", () => {
  const approved = {
    ...DEFAULT_SETTINGS,
    registration: { ...DEFAULT_SETTINGS.registration, agePolicyApproved: true, eligibilityApproved: true },
    legal: { ...DEFAULT_SETTINGS.legal, approved: { privacy: true, websiteTerms: true, contestantTerms: true, votingRules: true } },
  };
  it("is disabled without the environment flag", () => {
    expect(registrationState(approved, { enabledFlag: false, allowUnapproved: false }).state).toBe("disabled");
  });
  it("stays closed until policies are approved", () => {
    const r = registrationState(DEFAULT_SETTINGS, { enabledFlag: true, allowUnapproved: false, now: new Date("2027-01-01T00:00:00Z") });
    expect(r.state).toBe("pending_approval");
  });
  it("opens only within the window", () => {
    expect(registrationState(approved, { enabledFlag: true, allowUnapproved: false, now: new Date("2026-12-01T00:00:00Z") }).state).toBe("not_yet_open");
    expect(registrationState(approved, { enabledFlag: true, allowUnapproved: false, now: new Date("2027-01-10T00:00:00Z") }).state).toBe("open");
    expect(registrationState(approved, { enabledFlag: true, allowUnapproved: false, now: new Date("2027-02-01T00:00:00Z") }).state).toBe("closed");
  });
  it("allows staging overrides but flags them", () => {
    const r = registrationState(DEFAULT_SETTINGS, { enabledFlag: true, allowUnapproved: true, now: new Date("2026-11-20T00:00:00Z") });
    expect(r).toMatchObject({ state: "open", stagingOverride: true });
  });
});

describe("email rendering", () => {
  it("escapes HTML in variables and strips header injection from subjects", () => {
    const { html, subject } = renderEmail("Hi {{name}}\r\nBcc: x@y.z", "Hello {{name}}", { name: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(subject).not.toMatch(/[\r\n]/);
    expect(fillTemplate("{{missing}}", {}, true)).toBe("");
  });
});

describe("csv", () => {
  it("neutralises formula injection", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+64211234567")).toBe("\"'+64211234567\"");
    expect(csvCell(null)).toBe("\"\"");
  });
});

describe("roles", () => {
  it("applies least privilege", () => {
    expect(can(["finance_viewer"], "applications:read")).toBe(false);
    expect(can(["finance_viewer"], "finance:read")).toBe(true);
    expect(can(["content_editor"], "voting:configure")).toBe(false);
    expect(can(["application_reviewer"], "applications:update")).toBe(true);
    expect(can(["organiser_admin"], "users:manage")).toBe(false);
    expect(can(["super_admin"], "users:manage")).toBe(true);
  });
});

describe("QR base URL", () => {
  it("always uses the canonical domain in production", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging-xyz.vercel.app";
    expect(qrBaseUrl(true)).toBe("https://www.mrindianz.co.nz");
    expect(qrBaseUrl(false)).toBe("https://staging-xyz.vercel.app");
    process.env.NEXT_PUBLIC_SITE_URL = prev;
  });
});

import { formatNzDate } from "@/lib/format";
describe("calendar dates", () => {
  it("formats date-only values without shifting the day", () => {
    expect(formatNzDate("2027-04-03")).toMatch(/Sat.*3 April 2027/);
    expect(formatNzDate("2026-12-15")).toMatch(/Tue.*15 December 2026/);
    expect(formatNzDate("2027-03-20")).toMatch(/Sat.*20 March 2027/);
  });
});
