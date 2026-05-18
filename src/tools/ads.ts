import { z } from "zod"
import { metaGet, metaPost } from "../meta-client"
import {
  AccountInput,
  activeWarning,
  EffectiveStatusEnum,
  PagingInput,
  StatusEnum,
} from "../schemas"
import { asErrorResult, asTextResult, resolveAccount, type ToolDef } from "./shared"

const DEFAULT_FIELDS =
  "id,name,adset_id,campaign_id,status,effective_status,creative,preview_shareable_link,created_time,updated_time"

const ListAdsInput = AccountInput.merge(PagingInput).extend({
  adset_id: z.string().optional().describe("Scope to one ad set."),
  campaign_id: z.string().optional().describe("Scope to one campaign."),
  status_filter: z.array(EffectiveStatusEnum).optional(),
  fields: z.string().optional().describe(`Default: ${DEFAULT_FIELDS}`),
})

const GetAdInput = z.object({
  ad_id: z.string().describe("Numeric ad id."),
  fields: z.string().optional(),
})

export const adTools: ToolDef[] = [
  {
    name: "list_ads",
    description:
      "List ads. Defaults to all in the account; scope to a campaign or ad set with the optional ids.",
    inputSchema: ListAdsInput,
    handler: async (raw) => {
      try {
        const input = ListAdsInput.parse(raw)
        const params: Record<string, string | number> = {
          fields: input.fields ?? DEFAULT_FIELDS,
          limit: input.limit ?? 25,
        }
        if (input.after) params.after = input.after
        if (input.status_filter && input.status_filter.length > 0) {
          params.effective_status = JSON.stringify(input.status_filter)
        }
        const path = input.adset_id
          ? `${input.adset_id}/ads`
          : input.campaign_id
            ? `${input.campaign_id}/ads`
            : `${resolveAccount(input)}/ads`
        const result = await metaGet(path, params)
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "get_ad",
    description: "Fetch one ad by id.",
    inputSchema: GetAdInput,
    handler: async (raw) => {
      try {
        const input = GetAdInput.parse(raw)
        const result = await metaGet(input.ad_id, {
          fields: input.fields ?? DEFAULT_FIELDS,
        })
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
]

const CreateAdInput = AccountInput.extend({
  adset_id: z.string(),
  name: z.string().min(1),
  creative_id: z.string().describe("Numeric ad creative id (use create_creative first)."),
  status: StatusEnum.default("PAUSED"),
})

const UpdateAdInput = z.object({
  ad_id: z.string(),
  name: z.string().optional(),
  status: StatusEnum.optional(),
  creative_id: z.string().optional().describe("Swap to a different ad creative."),
})

const IdInput = z.object({ ad_id: z.string() })

adTools.push(
  {
    name: "create_ad",
    description:
      "Create an ad under an ad set, pointing to an existing creative. Defaults to PAUSED.",
    inputSchema: CreateAdInput,
    handler: async (raw) => {
      try {
        const input = CreateAdInput.parse(raw)
        const account = resolveAccount(input)
        const result = await metaPost(`${account}/ads`, {
          adset_id: input.adset_id,
          name: input.name,
          creative: { creative_id: input.creative_id },
          status: input.status,
        })
        return asTextResult(result, activeWarning(input.status))
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "update_ad",
    description: "Update ad fields. Pass creative_id to swap creatives.",
    inputSchema: UpdateAdInput,
    handler: async (raw) => {
      try {
        const input = UpdateAdInput.parse(raw)
        const body: Record<string, unknown> = {}
        if (input.name !== undefined) body.name = input.name
        if (input.status !== undefined) body.status = input.status
        if (input.creative_id) body.creative = { creative_id: input.creative_id }
        const result = await metaPost(input.ad_id, body)
        return asTextResult(result, activeWarning(input.status))
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "pause_ad",
    description: "Convenience: set ad status to PAUSED.",
    inputSchema: IdInput,
    handler: async (raw) => {
      try {
        const input = IdInput.parse(raw)
        const result = await metaPost(input.ad_id, { status: "PAUSED" })
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "resume_ad",
    description: "Convenience: set ad status to ACTIVE.",
    inputSchema: IdInput,
    handler: async (raw) => {
      try {
        const input = IdInput.parse(raw)
        const result = await metaPost(input.ad_id, { status: "ACTIVE" })
        return asTextResult(result, activeWarning("ACTIVE"))
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
)

export { DEFAULT_FIELDS as AD_DEFAULT_FIELDS }
