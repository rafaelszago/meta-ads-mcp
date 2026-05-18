import { z } from "zod"
import { metaGet } from "../meta-client"
import { AccountInput, DatePreset, PagingInput } from "../schemas"
import { asErrorResult, asTextResult, resolveAccount, type ToolDef } from "./shared"

const DEFAULT_FIELDS =
  "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,action_values,cost_per_action_type,purchase_roas,date_start,date_stop"

const TimeRange = z
  .object({
    since: z.string().describe("YYYY-MM-DD"),
    until: z.string().describe("YYYY-MM-DD (inclusive)"),
  })
  .describe("Custom date range. Mutually exclusive with date_preset.")

const InsightsLevel = z.enum(["account", "campaign", "adset", "ad"])

const GetInsightsInput = AccountInput.merge(PagingInput).extend({
  level: InsightsLevel.default("campaign"),
  object_id: z
    .string()
    .optional()
    .describe("Specific entity id to query. Defaults to the account."),
  date_preset: DatePreset.optional().describe("Use either date_preset OR time_range, not both."),
  time_range: TimeRange.optional(),
  fields: z.string().optional().describe(`Default: ${DEFAULT_FIELDS}`),
  breakdowns: z
    .array(z.string())
    .optional()
    .describe("e.g. ['age','gender'], ['country'], ['publisher_platform']."),
  action_breakdowns: z.array(z.string()).optional().describe("e.g. ['action_type']."),
  filtering: z
    .array(z.unknown())
    .optional()
    .describe("Raw Meta filtering array. Each entry: { field, operator, value }."),
})

const GetAccountSummaryInput = AccountInput.extend({
  date_preset: DatePreset.default("this_month"),
})

const SUMMARY_FIELDS = "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,purchase_roas"

export const insightTools: ToolDef[] = [
  {
    name: "get_insights",
    description:
      "Fetch performance insights. Level controls aggregation (account/campaign/adset/ad). Use either date_preset or time_range. Supports breakdowns, action_breakdowns, filtering.",
    inputSchema: GetInsightsInput,
    handler: async (raw) => {
      try {
        const input = GetInsightsInput.parse(raw)
        if (input.date_preset && input.time_range) {
          throw new Error("Use either date_preset OR time_range, not both.")
        }
        const target = input.object_id ?? resolveAccount(input)
        const params: Record<string, string | number> = {
          level: input.level,
          fields: input.fields ?? DEFAULT_FIELDS,
          limit: input.limit ?? 100,
        }
        if (input.after) params.after = input.after
        if (input.date_preset) params.date_preset = input.date_preset
        if (input.time_range) params.time_range = JSON.stringify(input.time_range)
        if (input.breakdowns?.length) params.breakdowns = input.breakdowns.join(",")
        if (input.action_breakdowns?.length)
          params.action_breakdowns = input.action_breakdowns.join(",")
        if (input.filtering?.length) params.filtering = JSON.stringify(input.filtering)
        const result = await metaGet(`${target}/insights`, params)
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "get_account_summary",
    description:
      "Convenience: account-level spend/impressions/clicks/CTR/CPC/CPM/reach for a date preset (default this_month).",
    inputSchema: GetAccountSummaryInput,
    handler: async (raw) => {
      try {
        const input = GetAccountSummaryInput.parse(raw)
        const account = resolveAccount(input)
        const result = await metaGet(`${account}/insights`, {
          level: "account",
          fields: SUMMARY_FIELDS,
          date_preset: input.date_preset,
        })
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
]
