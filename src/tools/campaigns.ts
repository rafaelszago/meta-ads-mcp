import { z } from "zod"
import { metaGet, metaPost } from "../meta-client"
import {
  AccountInput,
  activeWarning,
  EffectiveStatusEnum,
  Objective,
  PagingInput,
  SpecialAdCategory,
  StatusEnum,
} from "../schemas"
import { asErrorResult, asTextResult, resolveAccount, type ToolDef } from "./shared"

const DEFAULT_FIELDS =
  "id,name,objective,status,effective_status,daily_budget,lifetime_budget,buying_type,bid_strategy,special_ad_categories,created_time,updated_time,start_time,stop_time"

const ListCampaignsInput = AccountInput.merge(PagingInput).extend({
  status_filter: z
    .array(EffectiveStatusEnum)
    .optional()
    .describe("Filter by effective_status. Omit for all."),
  fields: z.string().optional().describe(`Comma-separated fields. Default: ${DEFAULT_FIELDS}`),
})

const GetCampaignInput = z.object({
  campaign_id: z.string().describe("Numeric campaign id."),
  fields: z.string().optional(),
})

export const campaignTools: ToolDef[] = [
  {
    name: "list_campaigns",
    description: "List campaigns under the ad account. Supports status filter and paging.",
    inputSchema: ListCampaignsInput,
    handler: async (raw) => {
      try {
        const input = ListCampaignsInput.parse(raw)
        const account = resolveAccount(input)
        const params: Record<string, string | number> = {
          fields: input.fields ?? DEFAULT_FIELDS,
          limit: input.limit ?? 25,
        }
        if (input.after) params.after = input.after
        if (input.status_filter && input.status_filter.length > 0) {
          params.effective_status = JSON.stringify(input.status_filter)
        }
        const result = await metaGet(`${account}/campaigns`, params)
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "get_campaign",
    description: "Fetch one campaign by id with full default fields (or custom fields).",
    inputSchema: GetCampaignInput,
    handler: async (raw) => {
      try {
        const input = GetCampaignInput.parse(raw)
        const result = await metaGet(input.campaign_id, {
          fields: input.fields ?? DEFAULT_FIELDS,
        })
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
]

const CreateCampaignInput = AccountInput.extend({
  name: z.string().min(1),
  objective: Objective,
  status: StatusEnum.default("PAUSED").describe(
    "Default PAUSED. Set ACTIVE to launch immediately.",
  ),
  special_ad_categories: z
    .array(SpecialAdCategory)
    .default(["NONE"])
    .describe("Required by Meta. Use ['NONE'] unless the campaign is for housing/credit/etc."),
  daily_budget: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("CBO daily budget in the account currency's minor units (cents)."),
  lifetime_budget: z.number().int().positive().optional(),
  bid_strategy: z
    .enum([
      "LOWEST_COST_WITHOUT_CAP",
      "LOWEST_COST_WITH_BID_CAP",
      "COST_CAP",
      "LOWEST_COST_WITH_MIN_ROAS",
    ])
    .optional(),
  buying_type: z.enum(["AUCTION", "RESERVED"]).optional(),
  is_adset_budget_sharing_enabled: z
    .boolean()
    .optional()
    .describe(
      "Required by Meta when not using campaign-level CBO. Defaults to false (ABO — each ad set holds its own budget). Set true to let ad sets share 20% of the campaign budget.",
    ),
})

const UpdateCampaignInput = z.object({
  campaign_id: z.string(),
  name: z.string().optional(),
  status: StatusEnum.optional(),
  daily_budget: z.number().int().positive().optional(),
  lifetime_budget: z.number().int().positive().optional(),
  bid_strategy: z
    .enum([
      "LOWEST_COST_WITHOUT_CAP",
      "LOWEST_COST_WITH_BID_CAP",
      "COST_CAP",
      "LOWEST_COST_WITH_MIN_ROAS",
    ])
    .optional(),
})

const IdInput = z.object({ campaign_id: z.string() })

campaignTools.push(
  {
    name: "create_campaign",
    description:
      "Create a new campaign. Defaults to status PAUSED — pass status: 'ACTIVE' to launch immediately (you'll get a soft warning in the response).",
    inputSchema: CreateCampaignInput,
    handler: async (raw) => {
      try {
        const input = CreateCampaignInput.parse(raw)
        const account = resolveAccount(input)
        const body: Record<string, unknown> = {
          name: input.name,
          objective: input.objective,
          status: input.status,
          special_ad_categories: input.special_ad_categories,
        }
        if (input.daily_budget !== undefined) body.daily_budget = input.daily_budget
        if (input.lifetime_budget !== undefined) body.lifetime_budget = input.lifetime_budget
        if (input.bid_strategy) body.bid_strategy = input.bid_strategy
        if (input.buying_type) body.buying_type = input.buying_type
        const usingCbo = input.daily_budget !== undefined || input.lifetime_budget !== undefined
        if (input.is_adset_budget_sharing_enabled !== undefined) {
          body.is_adset_budget_sharing_enabled = input.is_adset_budget_sharing_enabled
        } else if (!usingCbo) {
          body.is_adset_budget_sharing_enabled = false
        }
        const result = await metaPost(`${account}/campaigns`, body)
        return asTextResult(result, activeWarning(input.status))
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "update_campaign",
    description:
      "Update campaign fields (name, status, budget, bid_strategy). Only sends provided fields.",
    inputSchema: UpdateCampaignInput,
    handler: async (raw) => {
      try {
        const input = UpdateCampaignInput.parse(raw)
        const body: Record<string, unknown> = {}
        if (input.name !== undefined) body.name = input.name
        if (input.status !== undefined) body.status = input.status
        if (input.daily_budget !== undefined) body.daily_budget = input.daily_budget
        if (input.lifetime_budget !== undefined) body.lifetime_budget = input.lifetime_budget
        if (input.bid_strategy) body.bid_strategy = input.bid_strategy
        const result = await metaPost(input.campaign_id, body)
        return asTextResult(result, activeWarning(input.status))
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "pause_campaign",
    description: "Convenience: set campaign status to PAUSED.",
    inputSchema: IdInput,
    handler: async (raw) => {
      try {
        const input = IdInput.parse(raw)
        const result = await metaPost(input.campaign_id, { status: "PAUSED" })
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "resume_campaign",
    description:
      "Convenience: set campaign status to ACTIVE. Note this resumes spend — verify the campaign before calling.",
    inputSchema: IdInput,
    handler: async (raw) => {
      try {
        const input = IdInput.parse(raw)
        const result = await metaPost(input.campaign_id, { status: "ACTIVE" })
        return asTextResult(result, activeWarning("ACTIVE"))
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
)

// EffectiveStatusEnum re-exported for downstream tool files that import from here.
export { DEFAULT_FIELDS as CAMPAIGN_DEFAULT_FIELDS, EffectiveStatusEnum }
