import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import { z } from "zod"
import { metaGet, metaPost } from "../meta-client"
import { AccountInput, PagingInput } from "../schemas"
import { asErrorResult, asTextResult, resolveAccount, type ToolDef } from "./shared"

const DEFAULT_FIELDS =
  "id,name,status,object_story_spec,object_story_id,thumbnail_url,image_url,image_hash,video_id,call_to_action_type,effective_object_story_id,asset_feed_spec"

const ListCreativesInput = AccountInput.merge(PagingInput).extend({
  fields: z.string().optional().describe(`Default: ${DEFAULT_FIELDS}`),
})

const GetCreativeInput = z.object({
  creative_id: z.string().describe("Numeric ad creative id."),
  fields: z.string().optional(),
})

export const creativeTools: ToolDef[] = [
  {
    name: "list_creatives",
    description: "List ad creatives in the account.",
    inputSchema: ListCreativesInput,
    handler: async (raw) => {
      try {
        const input = ListCreativesInput.parse(raw)
        const params: Record<string, string | number> = {
          fields: input.fields ?? DEFAULT_FIELDS,
          limit: input.limit ?? 25,
        }
        if (input.after) params.after = input.after
        const result = await metaGet(`${resolveAccount(input)}/adcreatives`, params)
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
  {
    name: "get_creative",
    description: "Fetch one ad creative by id.",
    inputSchema: GetCreativeInput,
    handler: async (raw) => {
      try {
        const input = GetCreativeInput.parse(raw)
        const result = await metaGet(input.creative_id, {
          fields: input.fields ?? DEFAULT_FIELDS,
        })
        return asTextResult(result)
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
]

const LinkData = z.object({
  link: z.string().url().describe("Destination URL."),
  message: z.string().optional().describe("Primary text (above the creative)."),
  name: z.string().optional().describe("Headline."),
  description: z.string().optional().describe("Link description (below headline)."),
  image_hash: z
    .string()
    .optional()
    .describe("Hash from an uploaded image. Use either image_hash OR picture."),
  picture: z.string().url().optional().describe("URL of an already-hosted image."),
  call_to_action: z
    .object({
      type: z.string().describe("e.g. LEARN_MORE, SIGN_UP, DOWNLOAD, INSTALL_MOBILE_APP."),
      value: z.object({ link: z.string().url().optional() }).optional(),
    })
    .optional(),
})

const VideoData = z.object({
  video_id: z.string(),
  image_url: z.string().url().optional().describe("Thumbnail."),
  message: z.string().optional(),
  title: z.string().optional(),
  call_to_action: z
    .object({
      type: z.string(),
      value: z.object({ link: z.string().url().optional() }).optional(),
    })
    .optional(),
})

const ObjectStorySpec = z
  .object({
    page_id: z.string().describe("Facebook Page id that owns the post."),
    instagram_actor_id: z
      .string()
      .optional()
      .describe("Instagram account id (instagram_user_id). Required if running on Instagram."),
    link_data: LinkData.optional(),
    video_data: VideoData.optional(),
  })
  .describe("Must include exactly one of link_data or video_data.")

const CreateCreativeInput = AccountInput.extend({
  name: z.string().min(1).describe("Internal name for the creative."),
  object_story_spec: ObjectStorySpec,
})

creativeTools.push({
  name: "create_creative",
  description:
    "Create an ad creative. Use link_data for image+link ads or video_data for video ads. Image asset must already be uploaded (image_hash) or hosted (picture).",
  inputSchema: CreateCreativeInput,
  handler: async (raw) => {
    try {
      const input = CreateCreativeInput.parse(raw)
      const account = resolveAccount(input)
      const result = await metaPost(`${account}/adcreatives`, {
        name: input.name,
        object_story_spec: input.object_story_spec,
      })
      return asTextResult(result)
    } catch (err) {
      return asErrorResult(err)
    }
  },
})

export type UploadedImage = {
  filename: string
  hash: string | null
  url: string | null
  raw?: unknown
}

export async function uploadImageFromPath(
  account: string,
  imagePath: string,
): Promise<UploadedImage> {
  const buf = await readFile(imagePath)
  const bytes = buf.toString("base64")
  const filename = basename(imagePath)
  const result = (await metaPost(`${account}/adimages`, { bytes })) as {
    images?: Record<string, { hash: string; url: string }>
  }
  const entry =
    result?.images?.[filename] ?? (result?.images ? Object.values(result.images)[0] : undefined)
  if (!entry?.hash) {
    return { filename, hash: null, url: null, raw: result }
  }
  return { filename, hash: entry.hash, url: entry.url }
}

const UploadImageInput = AccountInput.extend({
  image_path: z
    .string()
    .min(1)
    .describe(
      "Absolute path to a local image file (PNG/JPG). Read from disk and uploaded as base64.",
    ),
}).describe(
  "Upload an image to the ad account's image library. Returns the image_hash to use in creatives.",
)

creativeTools.push({
  name: "upload_image",
  description:
    "Upload a local image file to the ad account's image library (/adimages). Returns { hash, url, filename } so the hash can be used in create_creative's link_data.image_hash.",
  inputSchema: UploadImageInput,
  handler: async (raw) => {
    try {
      const input = UploadImageInput.parse(raw)
      const account = resolveAccount(input)
      const uploaded = await uploadImageFromPath(account, input.image_path)
      if (!uploaded.hash) {
        return asTextResult({ filename: uploaded.filename, raw: uploaded.raw })
      }
      return asTextResult({
        filename: uploaded.filename,
        hash: uploaded.hash,
        url: uploaded.url,
      })
    } catch (err) {
      return asErrorResult(err)
    }
  },
})

export { DEFAULT_FIELDS as CREATIVE_DEFAULT_FIELDS }
