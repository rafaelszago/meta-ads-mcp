import { createHash } from "node:crypto"
import { readdir, readFile, rename, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { z } from "zod"
import { AccountInput } from "../schemas"
import { uploadImageFromPath } from "./creatives"
import { asErrorResult, asTextResult, resolveAccount, type ToolDef } from "./shared"

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"])

type ManifestEntry = {
  filename: string
  image_hash: string
  url: string | null
  uploaded_at: string
  account_id: string
}

type Manifest = {
  images: Record<string, ManifestEntry>
}

function brandDir(override?: string): string {
  return resolve(override ?? join(process.cwd(), "brand"))
}

function manifestPath(brand: string): string {
  return join(brand, "manifest.json")
}

function imagesDir(brand: string): string {
  return join(brand, "assets", "images")
}

async function readManifest(path: string): Promise<Manifest> {
  try {
    const raw = await readFile(path, "utf8")
    const parsed = JSON.parse(raw) as Partial<Manifest>
    return { images: parsed.images ?? {} }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { images: {} }
    throw err
  }
}

async function writeManifestAtomic(path: string, manifest: Manifest): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  await rename(tmp, path)
}

async function listImageFiles(dir: string, only?: string[]): Promise<string[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return []
    throw err
  }
  const onlySet = only && only.length > 0 ? new Set(only) : null
  return entries
    .filter((name) => {
      const lower = name.toLowerCase()
      const ext = lower.slice(lower.lastIndexOf("."))
      if (!IMAGE_EXTENSIONS.has(ext)) return false
      if (name.startsWith(".")) return false
      if (onlySet && !onlySet.has(name)) return false
      return true
    })
    .sort()
}

async function sha256OfFile(path: string): Promise<string> {
  const buf = await readFile(path)
  return createHash("sha256").update(buf).digest("hex")
}

const SyncBrandAssetsInput = AccountInput.extend({
  filenames: z
    .array(z.string())
    .optional()
    .describe(
      "Restrict the scan to these filenames (relative to brand/assets/images). Default: scan all files.",
    ),
  brand_dir: z
    .string()
    .optional()
    .describe("Override the brand/ directory path. Defaults to <cwd>/brand."),
}).describe(
  "Upload any new images in brand/assets/images/ to the ad account, update brand/manifest.json with their image_hash, and skip files already uploaded (matched by sha256). Idempotent.",
)

export const brandTools: ToolDef[] = [
  {
    name: "sync_brand_assets",
    description:
      "Sync local image assets from brand/assets/images/ to the Meta ad account image library. Reads brand/manifest.json (sha256 -> image_hash), uploads any new files, writes the manifest back atomically, and returns { uploaded, skipped, manifest_path }. Use before /ads-launch when the campaign references new assets.",
    inputSchema: SyncBrandAssetsInput,
    handler: async (raw) => {
      try {
        const input = SyncBrandAssetsInput.parse(raw)
        const account = resolveAccount(input)
        const brand = brandDir(input.brand_dir)
        const manifestFile = manifestPath(brand)
        const images = imagesDir(brand)
        const manifest = await readManifest(manifestFile)

        const files = await listImageFiles(images, input.filenames)
        const uploaded: Array<{
          filename: string
          sha256: string
          image_hash: string
        }> = []
        const skipped: Array<{
          filename: string
          sha256: string
          image_hash: string
          reason: "already_uploaded"
        }> = []
        const failed: Array<{ filename: string; error: string }> = []

        for (const name of files) {
          const full = join(images, name)
          try {
            const sha = await sha256OfFile(full)
            const existing = manifest.images[sha]
            if (existing && existing.account_id === account) {
              skipped.push({
                filename: name,
                sha256: sha,
                image_hash: existing.image_hash,
                reason: "already_uploaded",
              })
              continue
            }
            const result = await uploadImageFromPath(account, full)
            if (!result.hash) {
              failed.push({
                filename: name,
                error: "Meta did not return an image_hash",
              })
              continue
            }
            manifest.images[sha] = {
              filename: name,
              image_hash: result.hash,
              url: result.url,
              uploaded_at: new Date().toISOString(),
              account_id: account,
            }
            uploaded.push({ filename: name, sha256: sha, image_hash: result.hash })
          } catch (err) {
            failed.push({
              filename: name,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }

        if (uploaded.length > 0) {
          await writeManifestAtomic(manifestFile, manifest)
        }

        return asTextResult({
          account_id: account,
          manifest_path: manifestFile,
          images_dir: images,
          scanned: files.length,
          uploaded,
          skipped,
          failed,
        })
      } catch (err) {
        return asErrorResult(err)
      }
    },
  },
]
