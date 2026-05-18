import { z } from "zod"
import { metaGet, metaPost } from "../meta-client"
import {
  AccountInput,
  activeWarning,
  BillingEvent,
  EffectiveStatusEnum,
  OptimizationGoal,
  PagingInput,
  StatusEnum,
} from "../schemas"
import { asErrorResult, asTextResult, resolveAccount, type ToolDef } from "./shared"

const DEFAULT_FIELDS =
  "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,bid_amount,billing_event,optimization_goal,targeting,start_time,end_time,created_time,updated_time"

const ListAdsetsInput = AccountInput.merge(PagingInput).extend({
  campaign_id: z
    .string()
    .optional()
    .describe("Scope to one campaign instead of the whole account."),
  status_filter: z.array(EffectiveStatusEnum).optional(),
  fields: z.string().optional().describe(`Default: ${DEFAULT_FIELDS}`),
})

const GetAdsetInput = z.object({
  adset_id: z.string().describe("Numeric ad set id."),
  fields: z.string().optional(),
})

export const adsetTools: ToolDef[] = [
  {
    name: "list_adsets",
    description:
      "List ad sets. By default lists all in the account; pass campaign_id to scope to one campaign.",
    inputSchema: ListAdsetsInput,
    handler: async (raw) => {
      try {
        const input = ListAdsetsInput.parse(raw)
        const params: Record<string, string | number> = {
          fields: input.fields ?? DEFAULT_FIELDS,
          limit: input.limit ?? 25,
        }
        if (input.after) params.after = input.after
        if (input.status_filter && input.status_filter.length > 0) {
          params.effective_status = JSON.stringify(input.status_filter)
        }
        const path = input.campaign_id
          ? `${input.campaign_id}/adsets`
          : `${resolveAccount(input)}/adsets`
        const result = await metaGet(path, params)
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "get_adset",
    description: "Fetch one ad set by id.",
    inputSchema: GetAdsetInput,
    handler: async (raw) => {
      try {
        const input = GetAdsetInput.parse(raw)
        const result = await metaGet(input.adset_id, {
          fields: input.fields ?? DEFAULT_FIELDS,
        })
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
]

const Targeting = z
  .object({
    geo_locations: z
      .object({
        countries: z.array(z.string()).optional().describe("ISO-3166 alpha-2, e.g. ['BR','US']."),
        cities: z.array(z.unknown()).optional(),
        regions: z.array(z.unknown()).optional(),
        location_types: z.array(z.string()).optional(),
      })
      .optional(),
    age_min: z.number().int().min(13).max(65).optional(),
    age_max: z.number().int().min(13).max(65).optional(),
    genders: z
      .array(z.number().int().min(1).max(2))
      .optional()
      .describe("1=male, 2=female. Omit for all."),
    interests: z.array(z.object({ id: z.string(), name: z.string().optional() })).optional(),
    behaviors: z.array(z.object({ id: z.string(), name: z.string().optional() })).optional(),
    flexible_spec: z.array(z.unknown()).optional(),
    exclusions: z.unknown().optional(),
    publisher_platforms: z
      .array(z.enum(["facebook", "instagram", "audience_network", "messenger"]))
      .optional(),
    facebook_positions: z.array(z.string()).optional(),
    instagram_positions: z.array(z.string()).optional(),
    locales: z.array(z.number().int()).optional().describe("Facebook locale IDs. e.g. 6 = PT_BR."),
    custom_audiences: z.array(z.object({ id: z.string(), name: z.string().optional() })).optional(),
    excluded_custom_audiences: z
      .array(z.object({ id: z.string(), name: z.string().optional() }))
      .optional(),
  })
  .describe(
    "Targeting spec. See developers.facebook.com/docs/marketing-api/audiences/reference/basic-targeting",
  )

const CreateAdsetInput = AccountInput.extend({
  campaign_id: z.string(),
  name: z.string().min(1),
  status: StatusEnum.default("PAUSED"),
  billing_event: BillingEvent,
  optimization_goal: OptimizationGoal,
  daily_budget: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Minor units (cents). Omit if campaign uses CBO."),
  lifetime_budget: z.number().int().positive().optional(),
  bid_amount: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Bid in minor units. Required for some optimization goals + bid_strategy combos."),
  targeting: Targeting,
  start_time: z.string().optional().describe("ISO 8601, e.g. 2026-05-20T00:00:00-0300"),
  end_time: z.string().optional(),
  destination_type: z
    .enum(["WEBSITE", "APP", "MESSENGER", "INSTAGRAM_DIRECT", "WHATSAPP", "PHONE_CALL"])
    .optional(),
  promoted_object: z
    .object({
      page_id: z.string().optional(),
      application_id: z.string().optional(),
      object_store_url: z.string().optional(),
      pixel_id: z.string().optional(),
      custom_event_type: z.string().optional(),
    })
    .optional()
    .describe("Required for conversion-optimized ad sets (pixel_id + custom_event_type)."),
})

const UpdateAdsetInput = z.object({
  adset_id: z.string(),
  name: z.string().optional(),
  status: StatusEnum.optional(),
  daily_budget: z.number().int().positive().optional(),
  lifetime_budget: z.number().int().positive().optional(),
  bid_amount: z.number().int().positive().optional(),
  targeting: Targeting.optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
})

const IdInput = z.object({ adset_id: z.string() })

adsetTools.push(
  {
    name: "create_adset",
    description:
      "Create an ad set under a campaign. Defaults to PAUSED. Targeting is required by Meta — pass at minimum geo_locations.countries.",
    inputSchema: CreateAdsetInput,
    handler: async (raw) => {
      try {
        const input = CreateAdsetInput.parse(raw)
        const account = resolveAccount(input)
        const body: Record<string, unknown> = {
          campaign_id: input.campaign_id,
          name: input.name,
          status: input.status,
          billing_event: input.billing_event,
          optimization_goal: input.optimization_goal,
          targeting: input.targeting,
        }
        if (input.daily_budget !== undefined) body.daily_budget = input.daily_budget
        if (input.lifetime_budget !== undefined) body.lifetime_budget = input.lifetime_budget
        if (input.bid_amount !== undefined) body.bid_amount = input.bid_amount
        if (input.start_time) body.start_time = input.start_time
        if (input.end_time) body.end_time = input.end_time
        if (input.destination_type) body.destination_type = input.destination_type
        if (input.promoted_object) body.promoted_object = input.promoted_object
        const result = await metaPost(`${account}/adsets`, body)
        return asTextResult(result, activeWarning(input.status))
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "update_adset",
    description: "Update ad set fields. Only sends provided fields.",
    inputSchema: UpdateAdsetInput,
    handler: async (raw) => {
      try {
        const input = UpdateAdsetInput.parse(raw)
        const body: Record<string, unknown> = {}
        if (input.name !== undefined) body.name = input.name
        if (input.status !== undefined) body.status = input.status
        if (input.daily_budget !== undefined) body.daily_budget = input.daily_budget
        if (input.lifetime_budget !== undefined) body.lifetime_budget = input.lifetime_budget
        if (input.bid_amount !== undefined) body.bid_amount = input.bid_amount
        if (input.targeting) body.targeting = input.targeting
        if (input.start_time) body.start_time = input.start_time
        if (input.end_time) body.end_time = input.end_time
        const result = await metaPost(input.adset_id, body)
        return asTextResult(result, activeWarning(input.status))
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "pause_adset",
    description: "Convenience: set ad set status to PAUSED.",
    inputSchema: IdInput,
    handler: async (raw) => {
      try {
        const input = IdInput.parse(raw)
        const result = await metaPost(input.adset_id, { status: "PAUSED" })
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "resume_adset",
    description:
      "Convenience: set ad set status to ACTIVE. Note this resumes spend — verify before calling.",
    inputSchema: IdInput,
    handler: async (raw) => {
      try {
        const input = IdInput.parse(raw)
        const result = await metaPost(input.adset_id, { status: "ACTIVE" })
        return asTextResult(result, activeWarning("ACTIVE"))
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
)

export { DEFAULT_FIELDS as ADSET_DEFAULT_FIELDS }
