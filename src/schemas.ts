import { z } from "zod"

export const StatusEnum = z.enum(["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"])
export type Status = z.infer<typeof StatusEnum>

export const EffectiveStatusEnum = z.enum([
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
  "DELETED",
  "PENDING_REVIEW",
  "DISAPPROVED",
  "PREAPPROVED",
  "PENDING_BILLING_INFO",
  "CAMPAIGN_PAUSED",
  "ADSET_PAUSED",
  "IN_PROCESS",
  "WITH_ISSUES",
])

export const PagingInput = z.object({
  limit: z.number().int().positive().max(500).optional().describe("Page size, default 25."),
  after: z.string().optional().describe("Cursor from previous response's paging.cursors.after."),
})

export const AccountInput = z.object({
  account_id: z
    .string()
    .regex(/^act_\d+$/)
    .optional()
    .describe("Ad account id with act_ prefix. Defaults to META_AD_ACCOUNT_ID."),
})

export const Objective = z.enum([
  "OUTCOME_AWARENESS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_APP_PROMOTION",
  "OUTCOME_SALES",
])

export const SpecialAdCategory = z.enum([
  "NONE",
  "HOUSING",
  "EMPLOYMENT",
  "CREDIT",
  "ISSUES_ELECTIONS_POLITICS",
  "ONLINE_GAMBLING_AND_GAMING",
  "FINANCIAL_PRODUCTS_SERVICES",
])

export const BillingEvent = z.enum([
  "IMPRESSIONS",
  "LINK_CLICKS",
  "POST_ENGAGEMENT",
  "VIDEO_VIEWS",
  "THRUPLAY",
  "APP_INSTALLS",
])

export const OptimizationGoal = z.enum([
  "REACH",
  "IMPRESSIONS",
  "LINK_CLICKS",
  "POST_ENGAGEMENT",
  "LANDING_PAGE_VIEWS",
  "OFFSITE_CONVERSIONS",
  "VALUE",
  "LEAD_GENERATION",
  "QUALITY_LEAD",
  "VIDEO_VIEWS",
  "THRUPLAY",
  "APP_INSTALLS",
])

export const DatePreset = z.enum([
  "today",
  "yesterday",
  "this_month",
  "last_month",
  "this_quarter",
  "maximum",
  "last_3d",
  "last_7d",
  "last_14d",
  "last_28d",
  "last_30d",
  "last_90d",
  "last_week_mon_sun",
  "last_week_sun_sat",
  "last_quarter",
  "last_year",
  "this_week_mon_today",
  "this_week_sun_today",
  "this_year",
])

export function activeWarning(status: Status | undefined): string | null {
  if (status === "ACTIVE")
    return "Status ACTIVE — this entity is live and may incur spend immediately."
  return null
}
