---
name: ads-launch
description: Guide the user through launching a new Meta Ads campaign end-to-end (campaign → adset → creative → ad). Defaults everything to PAUSED so the user reviews before going live. Use when the user asks to "launch a campaign", "create a new ad", "set up a Meta Ads campaign", or mentions "/ads-launch".
allowed-tools: mcp__meta-ads__list_campaigns, mcp__meta-ads__create_campaign, mcp__meta-ads__create_adset, mcp__meta-ads__create_creative, mcp__meta-ads__create_ad, mcp__meta-ads__get_campaign, mcp__meta-ads__get_adset, mcp__meta-ads__get_ad, mcp__meta-ads__sync_brand_assets, Read
---

# ads-launch — Guided campaign launch

Walk the user through creating a complete ad — campaign, ad set, creative, ad — in a single guided flow. Everything stays PAUSED until the user explicitly activates in Ads Manager.

## Step 0: Load brand context

Before asking the user anything:

1. Read `brand/brand.yaml` if it exists. Use it to pre-fill:
   - `placements.page_id` → `page_id`
   - `placements.instagram_actor_id` → `instagram_actor_id`
   - `defaults.objective` → fallback objective
   - `defaults.audience` → country/age/gender defaults
   - `defaults.cta_type` → CTA fallback
   - `defaults.daily_budget_minor` → budget fallback
   - `defaults.billing_event` → `billing_event` fallback
   - `naming_convention.*` → name generators
   - `utm.*` → UTM template applied to the destination link if it doesn't already have UTM params
2. Read `brand/voice.md` if it exists. Apply its tone, vocabulary, do/don't, and banned-claims rules when generating or reviewing primary text, headlines, and descriptions. If the user provides copy that violates `voice.md`, flag it before launching.
3. If the user invoked the skill with a campaign slug (e.g. `/ads-launch summer-promo`), also read:
   - `brand/campaigns/<slug>/brief.md` — objective, hypothesis, audience overrides, schedule, budget, success metric
   - `brand/campaigns/<slug>/copy.yaml` — destination link and per-variant copy + `image_filename` bindings
   Use these as the launch spec; only ask the user for anything missing.

If `brand/brand.yaml` is absent, fall back to asking every input. Tell the user once that they can run `cp brand/brand.yaml.example brand/brand.yaml` to skip the boilerplate next time.

## Step 1: Resolve assets

For each variant in `copy.yaml` (or each image the user provides):

1. Read `brand/manifest.json`. Look up the variant's `image_filename` in the manifest entries (`images.<sha>.filename`).
2. If every referenced filename is already in the manifest, capture the `image_hash` values and skip to step 2.
3. If any are missing, call `mcp__meta-ads__sync_brand_assets` (no args — it scans `brand/assets/images/`, uploads new files, updates the manifest). Re-read `brand/manifest.json` and resolve the hashes.
4. If a filename is still missing after sync, stop and tell the user the file is not in `brand/assets/images/`.

## Step 2: Gather remaining inputs (use AskUserQuestion in one batch for whatever the brand/brief did not supply)

1. **Goal / objective** — map to a Meta objective:
   - Brand awareness → `OUTCOME_AWARENESS`
   - Site traffic / link clicks → `OUTCOME_TRAFFIC`
   - Engagement (likes/comments/follows) → `OUTCOME_ENGAGEMENT`
   - Leads (form/WhatsApp/Messenger) → `OUTCOME_LEADS`
   - App installs / app events → `OUTCOME_APP_PROMOTION`
   - Purchases / conversions → `OUTCOME_SALES`
2. **Budget** — daily or lifetime, in the account's currency. Convert to minor units for the API (e.g. $50/day → `5000` cents).
3. **Audience** — country list, age range, gender, interests/behaviors (interest IDs come from Meta's targeting search; ask for keywords if unspecified).
4. **Creative** — primary text (message), headline, link URL, image (resolved from the manifest in step 1), CTA button.
5. **Page IDs** — already from `brand.yaml` if present.
6. **Schedule** — `start_time`, optional `end_time` (ISO 8601). Omit start to begin immediately when activated.

## Step 3: Create

1. **Campaign** — call `mcp__meta-ads__create_campaign` with a name rendered from `naming_convention.campaign` (tokens: `{brand}`, `{objective}`, `{date}`, falling back to `[goal] - YYYY-MM-DD - vN` if no convention is set), objective, `special_ad_categories: ['NONE']` unless the user indicates otherwise, status `PAUSED`. Capture the returned `id`.
2. **Ad set** — call `mcp__meta-ads__create_adset` with `campaign_id`, targeting, budget, `billing_event` (usually `IMPRESSIONS`), `optimization_goal` (match the campaign objective: `LINK_CLICKS` for traffic, `OFFSITE_CONVERSIONS` for sales, etc.), status `PAUSED`. Name from `naming_convention.adset`. Capture `id`.
3. **Creative + ad per variant** — for each variant:
   - Build `object_story_spec` with `page_id`, optional `instagram_actor_id`, and `link_data` carrying the variant's `image_hash`, `message`, `name` (headline), `description`, `call_to_action`, and the UTM-augmented `link`.
   - Call `mcp__meta-ads__create_creative`. Capture the creative `id`.
   - Call `mcp__meta-ads__create_ad` with `adset_id`, `creative_id`, name from `naming_convention.ad`, status `PAUSED`.

## Step 4: Summarize

Report:
- Campaign/adset/ad IDs.
- Ads Manager URL: `https://business.facebook.com/adsmanager/manage/campaigns?act=<account id without act_ prefix>&selected_campaign_ids=<campaign_id>`.
- Reminder that everything is PAUSED — the user flips status to ACTIVE in Ads Manager or via `resume_campaign`/`resume_adset`/`resume_ad`.

## Notes

- UTM injection: if `brand.yaml` defines `utm.*` and the variant's `link` carries no `utm_source` query param, append `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` rendered from the templates.
- For `OUTCOME_SALES` or `OUTCOME_LEADS`, the ad set needs a `promoted_object` with `pixel_id` + `custom_event_type` — ask for these (or read from `brand.yaml` if you've extended it).
- Don't accept image paths outside `brand/assets/images/` in this flow — that's what `upload_image` is for, used directly.
