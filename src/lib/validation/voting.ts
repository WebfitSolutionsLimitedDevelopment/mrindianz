import { z } from "zod";
import { checkbox, emailSchema, trimmed, uuidSchema } from "./common";

/**
 * Supporter checkout request. Deliberately contains NO price or vote fields: the server reads the
 * package price and vote quantity from the database. Unknown keys (e.g. a tampered "price") are stripped.
 */
export const voteCheckoutSchema = z.object({
  idempotencyKey: uuidSchema,
  campaignId: uuidSchema,
  contestantId: uuidSchema,
  packageId: uuidSchema,
  quantity: z.coerce.number().int({ error: "Quantity must be a whole number" }).min(1).max(100),
  supporterName: trimmed(1, 80, "Your name"),
  supporterEmail: emailSchema,
  displayAnonymously: checkbox.default(false),
  acceptTerms: checkbox.refine((v) => v, { error: "Please accept the voting rules" }),
});
export type VoteCheckoutInput = z.infer<typeof voteCheckoutSchema>;

export const votingPackageSchema = z.object({
  name: trimmed(1, 60, "Package name"),
  displayLabel: z.string().trim().max(60).optional().transform((v) => v || null),
  priceCents: z.coerce.number().int().min(50, { error: "Minimum price is $0.50" }).max(1_000_000),
  votes: z.coerce.number().int().min(1).max(1_000_000),
  isActive: checkbox.default(false),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  maxQuantity: z.coerce.number().int().min(1).max(100).default(10),
});

const optionalDateTime = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date/time" });
      return z.NEVER;
    }
    return d.toISOString();
  });

export const votingCampaignSchema = z
  .object({
    name: trimmed(2, 120, "Campaign name"),
    status: z.enum(["draft", "scheduled", "open", "paused", "closed", "finalised"]),
    opensAt: optionalDateTime,
    closesAt: optionalDateTime,
    showLeaderboard: checkbox.default(false),
    showVoteCounts: checkbox.default(false),
    showRankings: checkbox.default(false),
    showSupporterHistory: checkbox.default(false),
    freezeLeaderboard: checkbox.default(false),
    resultsPublished: checkbox.default(false),
    refreshIntervalSeconds: z.coerce.number().int().min(10).max(3600),
    maxQuantityPerOrder: z.coerce.number().int().min(1).max(100),
    rulesVersion: trimmed(1, 40, "Rules version"),
    priceNote: z.string().trim().max(500).optional().transform((v) => v || null),
  })
  .refine((v) => !v.opensAt || !v.closesAt || v.closesAt > v.opensAt, { path: ["closesAt"], error: "Close must be after open" });
