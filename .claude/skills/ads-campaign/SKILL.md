---
name: ads-campaign
description: Scaffold a new Meta Ads campaign — campaign + one or more ad sets, PAUSED — and persist the IDs to brand/campaigns/<slug>/ids.yaml so /ads-launch and other skills can attach creatives later. Use when the user asks to "scaffold a campaign", "create a campaign shell", "set up a campaign without ads yet", or mentions "/ads-campaign".
allowed-tools: mcp__meta-ads__list_campaigns, mcp__meta-ads__create_campaign, mcp__meta-ads__create_adset, mcp__meta-ads__get_campaign, mcp__meta-ads__get_adset, Read, Write, Edit, Bash
---

# ads-campaign — Scaffold a campaign + ad sets, persist the IDs

Create the campaign shell (campaign + one or more ad sets, PAUSED) and write the resulting IDs to `brand/campaigns/<slug>/ids.yaml`. This is the precursor to `/ads-launch`: once the IDs are saved, `/ads-launch <slug>` and future skills can look up the campaign/ad set by slug instead of re-creating them or parsing names.

This skill does **not** create creatives or ads. That's `/ads-launch <slug>` once you've filled in `copy.yaml`.

## Step 0: Resolve the slug

The skill must be tied to a slug — that's the directory name under `brand/campaigns/` where `ids.yaml` will live.

1. If invoked as `/ads-campaign <slug>`, use that slug.
2. Otherwise, ask the user for a slug (kebab-case, e.g. `summer-promo`).
3. If `brand/campaigns/<slug>/` doesn't exist, ask the user whether to:
   - Create the folder now (copy from `brand/campaigns/_template/`), or
   - Abort so they can scaffold the brief first.

## Step 1: Load brand context

1. Read `brand/brand.yaml`. Use it to pre-fill:
   - `account.id` → tagged into `ids.yaml`
   - `defaults.objective`, `defaults.daily_budget_minor`, `defaults.billing_event`, `defaults.audience.*`
   - `naming_convention.campaign`, `naming_convention.adset` → name generators
2. If `brand/campaigns/<slug>/brief.md` exists, read it. Use it for: objective, hypothesis, audience overrides, schedule, budget. Only ask the user for anything missing.
3. Skip `copy.yaml` — not needed at this stage.

If `brand/brand.yaml` is absent, fall back to asking every input. Tell the user once that they can run `cp brand/brand.yaml.example brand/brand.yaml` to skip the boilerplate next time.

## Step 2: Check for existing `ids.yaml`

Read `brand/campaigns/<slug>/ids.yaml` if it exists. Three cases:

1. **File does not exist** → proceed to Step 3 (create campaign + ad set(s) from scratch).
2. **File exists, `account_id` matches `brand.yaml` `account.id`, and has a `campaign.id`** → the campaign already exists. Ask the user:
   - "Add one or more new ad sets under the existing campaign?" (most common — skip to Step 4 using `campaign.id` from the file)
   - "Abort — campaign is already scaffolded"
   - "Recreate from scratch (overwrites the file)" — require explicit confirmation
3. **File exists but `account_id` differs from current `brand.yaml`** → abort. Tell the user the slug is bound to a different account; they should either switch accounts or use a different slug.

## Step 3: Gather inputs

In one `AskUserQuestion` batch, ask for anything that the brief + `brand.yaml` didn't supply:

1. **Objective** — map to a Meta objective (`OUTCOME_AWARENESS`, `OUTCOME_TRAFFIC`, `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`, `OUTCOME_APP_PROMOTION`, `OUTCOME_SALES`).
2. **Daily budget** — in the account's currency. Convert to minor units (e.g. $50/day → `5000`).
3. **Billing event / optimization goal** — billing event defaults from `brand.yaml`; optimization goal should match the objective (`LINK_CLICKS` for traffic, `OFFSITE_CONVERSIONS` for sales, etc.).
4. **Number of ad sets** — default 1. Ask up front so you can batch audience questions.
5. **Per ad set: audience** — countries, age range, gender, interest keywords, custom audiences, exclusions. If multiple ad sets, ask once per ad set with a clear label (e.g. "Adset 1 of 2: audience override").
6. **Schedule** — `start_time`, optional `end_time` (ISO 8601). Omit start to begin when activated.
7. **For `OUTCOME_SALES` / `OUTCOME_LEADS`** — `promoted_object` with `pixel_id` and `custom_event_type` (e.g. `PURCHASE`, `LEAD`). Ask if not in brand.yaml.

## Step 4: Create

1. **Campaign** (skip if reusing existing campaign from Step 2 case 2):
   - Name from `naming_convention.campaign` (tokens: `{brand}`, `{objective}`, `{date}`, fallback `[goal] - YYYY-MM-DD`).
   - `special_ad_categories: ['NONE']` unless the user indicates otherwise.
   - `status: 'PAUSED'`.
   - Call `mcp__meta-ads__create_campaign`. Capture the returned `id`.

2. **Ad set(s)** — for each adset requested in Step 3:
   - Name from `naming_convention.adset` (typically `{audience}` — render audience to a short slug).
   - `campaign_id` = the new (or reused) campaign id.
   - Targeting, daily budget (minor units), `billing_event`, `optimization_goal`, schedule, `promoted_object` if applicable.
   - `status: 'PAUSED'`.
   - Call `mcp__meta-ads__create_adset`. Capture each `id`.

If any call fails, stop. Do NOT write a partial `ids.yaml` — report what was created (if anything) and let the user retry. If the campaign was created but ad set creation failed, write `ids.yaml` with the campaign but empty `adsets[]` so the next run can resume by adding the ad set under the existing campaign.

## Step 5: Persist IDs

Write or update `brand/campaigns/<slug>/ids.yaml`. The file is the single source of truth for "what Meta entities belong to this slug." Schema:

```yaml
# Auto-managed by /ads-campaign and /ads-launch. Safe to read; don't hand-edit
# unless you know what you're doing — the skills append to this file.
slug: "<slug>"
account_id: "act_1234567890"
campaign:
  id: "23851234567890123"
  name: "Acme | OUTCOME_TRAFFIC | 2026-05-21"
  objective: "OUTCOME_TRAFFIC"
  created_at: "2026-05-21T14:32:10Z"
adsets:
  - id: "23851234567890456"
    name: "US 25-45 interests:running"
    created_at: "2026-05-21T14:32:14Z"
ads: []
```

Rules:

- **Create vs. append:**
  - If `ids.yaml` did not exist, write the whole file.
  - If it existed and you reused the campaign, leave `campaign` alone and append new `adsets[]` entries (one per ad set created in Step 4). Preserve `ads` and any other top-level keys.
- **IDs are strings.** Meta entity IDs exceed `Number.MAX_SAFE_INTEGER`. Always quote them.
- **`created_at`** is ISO 8601 UTC, captured at write time.
- **Append-only within a slug.** Never rewrite or reorder existing `adsets[]` or `ads[]` entries; only add new ones.
- Use `Write` for first creation; use `Edit` for appends (read the file, locate the `adsets:` block, insert new list items, write back). If the file shape is unexpected (missing `adsets:` key, malformed YAML), stop and ask the user — do NOT silently regenerate.

## Step 6: Summarize

Report:

- Campaign ID + name.
- Each ad set ID + name.
- `brand/campaigns/<slug>/ids.yaml` path — confirm it's saved.
- Ads Manager URL: `https://business.facebook.com/adsmanager/manage/campaigns?act=<account id without act_ prefix>&selected_campaign_ids=<campaign_id>`.
- Reminder that everything is PAUSED.
- Next step: "Fill in `brand/campaigns/<slug>/copy.yaml` with your creative variants, then run `/ads-launch <slug>` to attach creatives + ads. It will reuse the campaign + ad set from `ids.yaml`."

## Notes

- This skill never activates anything. Status flips happen in Ads Manager or via `/ads-pause` resume.
- If the user invokes `/ads-campaign` without a slug AND there is no plausible default, prompt them to pick one — don't invent a slug.
- Don't accept campaign IDs the user types in. If they already have a campaign and want to attach `ids.yaml` to it manually, tell them: stop the skill, hand-write `ids.yaml` (the schema is documented in `docs/brand-workflow.md`), then run skills against the slug.
