# Tools reference

All 24 MCP tools exposed by `meta-ads-mcp`. Tools are namespaced `mcp__meta-ads__<name>` in Claude Code.

## Conventions

- **`account_id`** — every tool that addresses the ad account accepts an optional `account_id` (string, must match `^act_\d+$`). Defaults to `META_AD_ACCOUNT_ID` from `.env`. Skip this from the per-tool input lists below; assume it's there.
- **Budgets are in minor units** — `daily_budget: 5000` means **$50.00** for a USD account, **R$ 50,00** for a BRL account, etc.
- **Status defaults to `PAUSED`** on every `create_*`. Pass `status: "ACTIVE"` to launch immediately; the response includes a soft warning string. `update_*` also accepts `status`.
- **Paging** — list tools accept `limit` (1–500, default 25) and `after` (cursor from the previous response's `paging.cursors.after`).
- **Fields** — list/get tools accept an optional `fields` (comma-separated) to override the default field set.

---

## Campaigns

### `list_campaigns`

List campaigns in the ad account.

- **Inputs:**
  - `status_filter?: EffectiveStatus[]` — e.g. `["ACTIVE","PAUSED"]`. Omit for all.
  - `fields?: string`, `limit?`, `after?`.
- **Returns:** `{ data: Campaign[], paging }`. Default fields include `id,name,objective,status,effective_status,daily_budget,lifetime_budget,buying_type,bid_strategy,special_ad_categories,created_time,updated_time,start_time,stop_time`.
- **Example:** `"list my active campaigns"` → `list_campaigns({ status_filter: ["ACTIVE"] })`.

### `get_campaign`

Fetch one campaign by id.

- **Inputs:** `campaign_id: string`, `fields?: string`.
- **Returns:** a single `Campaign` object.
- **Example:** `"get campaign 23842..."` → `get_campaign({ campaign_id: "23842..." })`.

### `create_campaign`

Create a new campaign.

- **Inputs:**
  - `name: string`
  - `objective: "OUTCOME_AWARENESS" | "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" | "OUTCOME_LEADS" | "OUTCOME_APP_PROMOTION" | "OUTCOME_SALES"`
  - `status?: Status` — defaults to `PAUSED`.
  - `special_ad_categories?: SpecialAdCategory[]` — defaults to `["NONE"]`. Use the matching category for housing/credit/employment/etc.
  - `daily_budget?: number` (minor units, CBO)
  - `lifetime_budget?: number` (minor units)
  - `bid_strategy?: "LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP" | "LOWEST_COST_WITH_MIN_ROAS"`
  - `buying_type?: "AUCTION" | "RESERVED"`
- **Returns:** `{ id }`. Soft warning string in the response if `status` was `ACTIVE`.
- **Example:** `"create a traffic campaign called Summer Launch with a $50/day budget, paused"` → `create_campaign({ name: "Summer Launch", objective: "OUTCOME_TRAFFIC", daily_budget: 5000 })`.

### `update_campaign`

Update fields on a campaign. Only the fields you pass are sent.

- **Inputs:** `campaign_id: string`, plus any of `name`, `status`, `daily_budget`, `lifetime_budget`, `bid_strategy`.
- **Returns:** `{ success: true }` or the updated subset.

### `pause_campaign`

Convenience: set status to `PAUSED`.

- **Inputs:** `campaign_id: string`.

### `resume_campaign`

Convenience: set status to `ACTIVE`. Response includes a soft warning that spend is live.

- **Inputs:** `campaign_id: string`.

---

## Ad sets

### `list_adsets`

List ad sets.

- **Inputs:**
  - `campaign_id?: string` — scope to one campaign; omit for the whole account.
  - `status_filter?: EffectiveStatus[]`, `fields?`, `limit?`, `after?`.
- **Returns:** `{ data: AdSet[], paging }`. Default fields include targeting, billing/optimization, budgets, schedule.

### `get_adset`

Fetch one ad set by id.

- **Inputs:** `adset_id: string`, `fields?: string`.

### `create_adset`

Create an ad set under a campaign.

- **Inputs:**
  - `campaign_id: string`
  - `name: string`
  - `status?: Status` — defaults to `PAUSED`.
  - `billing_event: "IMPRESSIONS" | "LINK_CLICKS" | "POST_ENGAGEMENT" | "VIDEO_VIEWS" | "THRUPLAY" | "APP_INSTALLS"`
  - `optimization_goal: "REACH" | "IMPRESSIONS" | "LINK_CLICKS" | "POST_ENGAGEMENT" | "LANDING_PAGE_VIEWS" | "OFFSITE_CONVERSIONS" | "VALUE" | "LEAD_GENERATION" | "QUALITY_LEAD" | "VIDEO_VIEWS" | "THRUPLAY" | "APP_INSTALLS"`
  - `daily_budget?: number` (minor units; omit for CBO at the campaign level)
  - `lifetime_budget?: number`
  - `bid_amount?: number` (minor units)
  - `targeting: Targeting` — at minimum `geo_locations.countries`. Supports `age_min`, `age_max`, `genders` (`[1]`=male, `[2]`=female), `interests`, `behaviors`, `custom_audiences`, `excluded_custom_audiences`, `publisher_platforms`, `facebook_positions`, `instagram_positions`, `locales`.
  - `start_time?: string` (ISO 8601), `end_time?: string`
  - `destination_type?: "WEBSITE" | "APP" | "MESSENGER" | "INSTAGRAM_DIRECT" | "WHATSAPP" | "PHONE_CALL"`
  - `promoted_object?: { page_id?, application_id?, object_store_url?, pixel_id?, custom_event_type? }` — required for conversion-optimized ad sets (`pixel_id` + `custom_event_type`).
- **Returns:** `{ id }`.
- **Notes:** Meta requires *some* targeting; an empty `targeting: {}` is rejected.

### `update_adset`

Update fields on an ad set. Pass any of: `name`, `status`, `daily_budget`, `lifetime_budget`, `bid_amount`, `targeting`, `start_time`, `end_time`.

### `pause_adset` / `resume_adset`

Convenience status setters. Resume includes a soft warning about live spend.

---

## Ads

### `list_ads`

List ads.

- **Inputs:**
  - `adset_id?: string` — scope to one ad set.
  - `campaign_id?: string` — scope to one campaign (if `adset_id` not given).
  - `status_filter?: EffectiveStatus[]`, `fields?`, `limit?`, `after?`.
- **Returns:** `{ data: Ad[], paging }`. Default fields include `creative`, `preview_shareable_link`.

### `get_ad`

Fetch one ad by id.

- **Inputs:** `ad_id: string`, `fields?: string`.

### `create_ad`

Create an ad under an ad set, pointing to an existing creative.

- **Inputs:**
  - `adset_id: string`
  - `name: string`
  - `creative_id: string` — call `create_creative` first.
  - `status?: Status` — defaults to `PAUSED`.
- **Returns:** `{ id }`.

### `update_ad`

Update an ad. Pass `creative_id` to swap creatives.

- **Inputs:** `ad_id: string`, plus any of `name`, `status`, `creative_id`.

### `pause_ad` / `resume_ad`

Convenience status setters.

---

## Creatives

### `list_creatives`

List ad creatives in the account.

- **Inputs:** `fields?`, `limit?`, `after?`.
- **Returns:** Default fields include `id,name,status,object_story_spec,object_story_id,thumbnail_url,image_url,image_hash,video_id,call_to_action_type,effective_object_story_id,asset_feed_spec`.

### `get_creative`

Fetch one creative by id.

- **Inputs:** `creative_id: string`, `fields?: string`.

### `create_creative`

Create an ad creative.

- **Inputs:**
  - `name: string` — internal name.
  - `object_story_spec`:
    - `page_id: string` — Facebook Page that owns the post.
    - `instagram_actor_id?: string` — required if running on Instagram.
    - Exactly one of:
      - `link_data: { link, message?, name?, description?, image_hash?, picture?, call_to_action? }`
      - `video_data: { video_id, image_url?, message?, title?, call_to_action? }`
- **Returns:** `{ id }`.
- **Notes:**
  - Image must already be uploaded (`image_hash` from `upload_image` / `sync_brand_assets`) or hosted at a URL (`picture`).
  - Video upload is out of scope — `video_id` must exist in Meta already.
  - `call_to_action.type`: `LEARN_MORE`, `SIGN_UP`, `DOWNLOAD`, `SHOP_NOW`, `INSTALL_MOBILE_APP`, etc.
  - **App must be in Live mode** or this fails with subcode `1885183`. See [`flip-fb-app-to-live.md`](./flip-fb-app-to-live.md).

### `upload_image`

Upload one local image to the ad account's `/adimages` library.

- **Inputs:** `image_path: string` — absolute path to a PNG or JPG.
- **Returns:** `{ filename, hash, url }`. Use the `hash` as `link_data.image_hash` when creating creatives.
- **Notes:** For bulk + dedupe, prefer `sync_brand_assets`. Use this when you want to upload a one-off file from anywhere on disk.

---

## Insights

### `get_insights`

Performance metrics, flexible level and date range.

- **Inputs:**
  - `level?: "account" | "campaign" | "adset" | "ad"` — default `"campaign"`.
  - `object_id?: string` — specific entity to query. Defaults to the account.
  - `date_preset?: DatePreset` — one of `today`, `yesterday`, `this_month`, `last_month`, `last_3d`, `last_7d`, `last_14d`, `last_28d`, `last_30d`, `last_90d`, `last_week_mon_sun`, `last_week_sun_sat`, `last_quarter`, `last_year`, `this_quarter`, `this_week_mon_today`, `this_week_sun_today`, `this_year`, `maximum`.
  - `time_range?: { since, until }` — `YYYY-MM-DD`, inclusive. **Mutually exclusive with `date_preset`.**
  - `fields?: string` — default `spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,action_values,cost_per_action_type,purchase_roas,date_start,date_stop`.
  - `breakdowns?: string[]` — e.g. `["age","gender"]`, `["country"]`, `["publisher_platform"]`.
  - `action_breakdowns?: string[]` — e.g. `["action_type"]`.
  - `filtering?: unknown[]` — raw Meta filter array: each entry `{ field, operator, value }`.
  - `limit?` (default 100), `after?`.
- **Returns:** `{ data: InsightRow[], paging }`.
- **Notes:** Some breakdowns are only valid at certain levels (e.g. `age,gender` requires `level: ad` or `adset`).

### `get_account_summary`

Account-level rollup for a date preset.

- **Inputs:** `date_preset?: DatePreset` — default `"this_month"`.
- **Returns:** `{ data: [{ spend, impressions, clicks, ctr, cpc, cpm, reach, frequency, actions, purchase_roas }] }`.

---

## Brand

### `sync_brand_assets`

Sync `brand/assets/images/` to the ad account's image library. Idempotent — only uploads files whose sha256 is not already in `brand/manifest.json` for the current account.

- **Inputs:**
  - `filenames?: string[]` — restrict the scan to these filenames (relative to `brand/assets/images/`). Default: scan everything.
  - `brand_dir?: string` — override the `brand/` directory path. Defaults to `<cwd>/brand`.
- **Returns:**
  ```json
  {
    "account_id": "act_...",
    "manifest_path": "/.../brand/manifest.json",
    "images_dir":    "/.../brand/assets/images",
    "scanned": 3,
    "uploaded": [{ "filename": "...", "sha256": "...", "image_hash": "..." }],
    "skipped":  [{ "filename": "...", "sha256": "...", "image_hash": "...", "reason": "already_uploaded" }],
    "failed":   [{ "filename": "...", "error": "..." }]
  }
  ```
- **Notes:**
  - Walks only the top level of `brand/assets/images/` (no recursion). Picks up `.jpg`, `.jpeg`, `.png` (case-insensitive). Skips hidden files.
  - Dedupe is by content sha256, so renaming a file on disk does NOT trigger a re-upload.
  - Manifest entries record `account_id`. Switching ad accounts (different `META_AD_ACCOUNT_ID`) re-uploads everything since the existing entries belong to the old account.
  - Manifest write is atomic (temp file + rename), so a crash mid-sync can't corrupt the JSON.
  - See [`brand-workflow.md`](./brand-workflow.md) for the manifest contract.
