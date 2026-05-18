# Troubleshooting

Symptom → cause → fix. Each section has a quick check you can run before digging in.

## Server won't start / not visible in `claude mcp list`

| Symptom | Cause | Fix |
| --- | --- | --- |
| `META_ACCESS_TOKEN is not set` | `.env` missing or not loaded. | Run from the project root. Copy `.env.example` to `.env` and fill it in. |
| `META_AD_ACCOUNT_ID is not set` | Same. | Same — and remember the `act_` prefix (`act_1234567890`). |
| `claude mcp list` shows `✗ Failed to connect` | Dependencies not installed; or `bun` not on PATH. | `bun install`. Check `which bun`. |
| Tools missing from a Claude Code session | `.mcp.json` is project-scoped — Claude Code only loads it when started in this directory. | Restart Claude Code inside `meta-ads-mcp/`. |
| Server starts, but every tool call returns `META_ACCESS_TOKEN is not set` | `.env` is in a different directory. | Restart the server from the project root. |

Quick check:

```bash
bun install
bun run src/server.ts < /dev/null   # should exit silently
claude mcp list
```

## Meta API errors (by code)

The MCP returns a JSON object with `error`, `status`, `code`, `subcode`, `fbtrace_id`. Map the most common ones:

### Code 190 — `Error validating access token`

Cause: token expired, revoked, or copy-paste truncation.
Fix: regenerate the System User token (see [`getting-started.md`](./getting-started.md#1-generate-a-system-user-access-token)). Make sure you copied the full token; Meta tokens are ~200+ chars.

### Code 200 — `Permissions error`

Cause: token is missing one of the required scopes.
Fix: regenerate with all of: `ads_management`, `ads_read`, `business_management`, `read_insights`, `pages_manage_ads`, `pages_read_engagement`.

### Code 100, subcode 33 — `Application does not have the capability`

Cause: your Meta developer app is missing the Marketing API product.
Fix: in the app dashboard → **Products → Add Product → Marketing API → Set Up**.

### Code 100, subcode 1885183 — `ads creative post was created by an app in development mode`

Cause: your developer app is still in **Development** mode, which blocks the *backing dark post* a creative needs.
Fix: flip the app to Live. See [`flip-fb-app-to-live.md`](./flip-fb-app-to-live.md). Reads + non-creative writes still work in dev mode; only `create_creative` and `create_ad` are blocked.

### Code 17 or 80004 — `User request limit reached`

Cause: Meta's BUC (per-account/per-app) rate limit.
Fix: wait one hour. To avoid hitting it again, batch list calls with `limit: 100`+ and prefer `get_account_summary` over multiple `get_insights` calls.

### Code 80000 family — `Application request limit reached`

Cause: app-level rate limit (shared across all System User tokens for the app).
Fix: wait, or use a different developer app for high-volume work.

### Code 2635 / 1815115 — pixel / promoted_object errors

Cause: ad set targets a conversion event but `promoted_object` is missing or invalid.
Fix: pass `promoted_object: { pixel_id, custom_event_type }` to `create_adset` for `OUTCOME_SALES` / `OUTCOME_LEADS`. Confirm the pixel exists in Events Manager.

## `sync_brand_assets` issues

| Symptom | Cause | Fix |
| --- | --- | --- |
| `scanned: 0` despite files in `brand/assets/images/` | Wrong extension (only `.jpg`, `.jpeg`, `.png` are picked up — case-insensitive) or filename starts with `.`. | Rename the file. |
| Every file appears in `uploaded` on the *second* run too | The previous run failed before the manifest write (no entries were added). | Check the previous response's `failed` array for the underlying error. Re-run once Meta accepts the file. |
| Every file re-uploads after changing `META_AD_ACCOUNT_ID` | By design — manifest entries are scoped per account. | Expected. After the first sync, future runs against the new account will skip. |
| `Meta did not return an image_hash` in `failed` | Meta accepted the POST but returned an unexpected shape. Usually a transient API glitch. | Re-run. If persistent, inspect the raw response by calling `upload_image` directly on the same file (returns `raw: ...` when the hash is missing). |
| `EACCES` writing the manifest | The `brand/` directory is read-only or owned by a different user. | `chmod -R u+w brand/`. |
| Manifest contains weird-looking entries | A previous version of the tool wrote them, or the file was hand-edited and broke the schema. | Delete `manifest.json` (it's `{ "images": {} }` by default) and re-run sync. Meta dedupes by content hash internally, so re-uploading is cheap. |

## Skills don't pick up `brand.yaml`

| Symptom | Cause | Fix |
| --- | --- | --- |
| Skill re-asks for fields you set in `brand.yaml` | The file is missing or in the wrong place. | Confirm it's at `brand/brand.yaml` in the project root. The skill reads it relative to the Claude Code working directory. |
| Skill throws a YAML parse error | Stray tab, unescaped colon, or wrong indentation. | Run `bun -e 'console.log(Bun.YAML.parse(await Bun.file("brand/brand.yaml").text()))'` to surface the parse error. Or paste into any online YAML linter. |
| Skill uses defaults despite `brand.yaml` being present | Claude Code was started from a different cwd, so `brand/` resolves to something else. | Restart Claude Code in `meta-ads-mcp/`. |
| `voice.md` rules aren't enforced | Skill loaded `brand.yaml` but `voice.md` is absent. | `cp brand/voice.md.example brand/voice.md`. |

## `/ads-launch` says an image is missing

Scenario: `copy.yaml` references `hero-v1.jpg`; the file is in `brand/assets/images/`; the skill still says "missing".

Cause: the file is on disk but not in `manifest.json`.

Fix: ask the skill to sync first, or call `sync_brand_assets` directly. After the sync, re-run `/ads-launch <slug>`.

If the file is *not* in `brand/assets/images/`: copy it there. `/ads-launch` will not accept paths outside that directory; use the lower-level `upload_image` tool if you need to upload a one-off file from anywhere on disk.

## Insights return empty

| Symptom | Cause | Fix |
| --- | --- | --- |
| `data: []` for an active campaign | Date range is outside the campaign's run window. | Try `date_preset: maximum` or a wider `time_range`. |
| `data: []` for a new account | Meta takes hours to surface the first insights. | Wait 1–2 hours. |
| Breakdown rejected with `invalid breakdown` | The breakdown isn't valid at the chosen `level`. | `age,gender` requires `level: ad` or `adset`. `country` works everywhere. |
| `purchase_roas` missing | Account isn't running a sales-objective campaign with a pixel. | Expected — ROAS only appears for conversion-tracked spend. |
| `actions` missing | The objective doesn't generate trackable actions. | Expected for awareness/reach. |

## General debugging

- **Re-run the failing tool directly** instead of through a skill. Skills compose multiple calls — isolating to one tool tells you which call broke.
- **Inspect the raw Meta response.** Every error includes `fbtrace_id` — paste it into a support request if you need to escalate.
- **Run the server with verbose logging:**
  ```bash
  DEBUG='*' bun run src/server.ts
  ```
  Then trigger the failing call from Claude Code. The Bun process prints request URLs and response bodies to stderr.
- **Check Ads Manager** for the entity you tried to create. Sometimes a creation "succeeds" but the entity is rejected during Meta's review — that appears in Ads Manager, not in the API response.
- **`config/optimization-targets.yaml`** is only read by `/ads-optimize`, `/ads-pause`, and `/ads-report`. If a threshold isn't behaving as expected, confirm the file was copied from `.example` and saved as `.yaml` (not `.example.yaml`).
