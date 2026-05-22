# Brand workflow

`brand/` is the single source of truth for everything *upstream* of an ad launch — brand voice, default audience, naming conventions, UTM templates, ad assets, and per-campaign briefs. Skills read from it so launches stop re-asking the same questions and reports/optimizations group results the way you think about the account.

## Directory layout

```
brand/
├── brand.yaml              # structured config (account, defaults, naming, UTM)
├── brand.yaml.example      # committed template
├── voice.md                # prose: tone, do/don't, banned claims, example copy
├── voice.md.example        # committed template
├── manifest.json           # sha256 -> uploaded image_hash (committed)
├── assets/
│   ├── images/             # drop .jpg/.png here for sync_brand_assets
│   └── videos/             # reference only; video_id is provided by user
└── campaigns/
    ├── _template/          # committed scaffold
    │   ├── brief.md
    │   └── copy.yaml
    └── <slug>/             # one folder per campaign brief
        ├── brief.md
        ├── copy.yaml
        └── ids.yaml        # auto-managed; written by /ads-campaign and /ads-launch
```

The `.example` files are committed so anyone cloning the repo can scaffold their own:

```bash
cp brand/brand.yaml.example brand/brand.yaml
cp brand/voice.md.example   brand/voice.md
```

## `brand.yaml` schema

See [`brand/brand.yaml.example`](../brand/brand.yaml.example) for the full template. Field-by-field reference:

### `brand`

| Field | Type | Required | Consumed by | Purpose |
| --- | --- | --- | --- | --- |
| `name` | string | recommended | `/ads-launch` (in generated names if `naming_convention` uses `{brand}`) | Display name. |
| `website` | string | optional | — | Reference only. |
| `one_liner` | string | optional | `/ads-launch` (fallback `primary_text`) | Short pitch used when `copy.yaml` omits primary text. |

### `account`

| Field | Type | Required | Consumed by | Purpose |
| --- | --- | --- | --- | --- |
| `id` | string (`act_<digits>`) | yes | all skills | Mirrors `META_AD_ACCOUNT_ID` for skill reads. Runtime account always comes from env. |
| `currency` | string (ISO 4217) | yes | `/ads-report`, `/ads-optimize` | Currency symbol for spend/CPC display. |
| `market` | string | optional | — | Reference only. |
| `timezone` | string (IANA) | optional | `/ads-report` | Used when interpreting "yesterday". |

### `placements`

| Field | Type | Required | Consumed by | Purpose |
| --- | --- | --- | --- | --- |
| `page_id` | string | yes | `/ads-launch` | Facebook Page that owns the ad post. |
| `instagram_actor_id` | string | optional | `/ads-launch` | Required when running on Instagram placements. |

### `defaults`

Pre-fill values for `/ads-launch` when the user (or a campaign brief) doesn't override.

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `objective` | Objective enum | — | Default Meta objective (e.g. `OUTCOME_TRAFFIC`). |
| `audience.countries` | string[] (ISO-3166 alpha-2) | — | e.g. `["US"]`. |
| `audience.age_min` / `audience.age_max` | int 13–65 | — | Defaults to Meta's broadest range when omitted. |
| `audience.genders` | `"all"` \| `"male"` \| `"female"` | `"all"` | Translated to `[1]`/`[2]` for the API. |
| `audience.interests_keywords` | string[] | `[]` | Keywords to search Meta's interest targeting (not interest IDs). |
| `cta_type` | string | — | CTA button (`LEARN_MORE`, `SHOP_NOW`, etc.). |
| `daily_budget_minor` | int | — | Daily budget in minor units (cents). |
| `billing_event` | BillingEvent enum | — | `IMPRESSIONS`, `LINK_CLICKS`, etc. |

### `naming_convention`

Templates used by `/ads-launch` to *generate* names and by `/ads-report` and `/ads-pause` to *parse* names back into facets. Tokens are substituted at launch time.

| Field | Tokens supported | Example |
| --- | --- | --- |
| `campaign` | `{brand}`, `{objective}`, `{date}`, `{variant}` | `"{brand} \| {objective} \| {date}"` |
| `adset` | `{audience}`, `{variant}` | `"{audience}"` |
| `ad` | `{variant}` | `"{variant}"` |
| `date_format` | strftime tokens | `"YYYY-MM-DD"` |

### `utm`

UTM parameters appended to the destination link when it does not already carry `utm_source`.

| Field | Purpose |
| --- | --- |
| `source` | `utm_source` value (typically `meta`). |
| `medium` | `utm_medium` value (typically `paid_social`). |
| `campaign` | Template for `utm_campaign`. Same tokens as `naming_convention`. |
| `content` | Template for `utm_content`. |

## `voice.md`

Free-form prose that the launch and optimize skills read verbatim. Keep it short and concrete — bullets beat paragraphs. The example file ships with these sections:

- **Tone** — high-level adjectives + one or two negative examples.
- **Vocabulary** — explicit `Use:` / `Avoid:` lists.
- **Do** — concrete copy-craft rules.
- **Don't** — explicit anti-patterns.
- **Example copy** — one or two real ad samples in your voice.
- **Banned claims** — anything legal/medical/competitor-named that can't appear in any ad.

Two short examples of how voice shapes generated copy:

**Consumer SaaS voice** (direct, second-person, short sentences):

> "Plan your day in 10 minutes. Free template — no sign-up to view."

**Premium e-commerce voice** (sensory, no sign-up CTAs):

> "Hand-stitched in Porto. New season, limited quantities. See the collection."

Same skill, same prompt — completely different output because `voice.md` differs.

## `manifest.json`

The contract:

```json
{
  "images": {
    "<sha256-of-file>": {
      "filename": "hero-v1.jpg",
      "image_hash": "abc123def456...",
      "url": "https://scontent.xx.fbcdn.net/...",
      "uploaded_at": "2026-05-18T17:48:00.000Z",
      "account_id": "act_1234567890"
    }
  }
}
```

Design choices, explained:

- **Keyed by content sha256, not filename.** Renaming a file on disk does NOT trigger a re-upload. Two different files with the same bytes share one entry.
- **Records `account_id`.** When `META_AD_ACCOUNT_ID` changes (e.g. you switch ad accounts), `sync_brand_assets` re-uploads everything because the existing entries belong to the old account.
- **Committed to git.** It's the source of truth for upload state — anyone cloning the repo can launch campaigns against the *same* image hashes without re-uploading.
- **Atomic writes.** The tool writes to `manifest.json.tmp` and renames on success, so a crash mid-sync can't leave a half-written JSON.

## `sync_brand_assets` behavior

| Concern | Behavior |
| --- | --- |
| Directory scanned | `brand/assets/images/` only (top level, no recursion). Override with `brand_dir`. |
| Extensions picked up | `.jpg`, `.jpeg`, `.png` (case-insensitive). |
| Hidden files | Skipped (anything starting with `.`). |
| Dedupe | Content sha256 vs. existing manifest entries for the same `account_id`. |
| Scope | Pass `filenames: ["hero-v1.jpg"]` to scan only those files. |
| Output | `{ uploaded, skipped, failed }` arrays, plus `manifest_path` and `images_dir`. |
| Failure isolation | One bad file (e.g. Meta rejects the image format) does not stop the others. The bad file appears in `failed`; everything else uploads. |

## Campaign briefs

`brand/campaigns/<slug>/` holds the *intent* for a specific launch. `/ads-launch <slug>` reads `brief.md` and `copy.yaml` and uses them as the launch spec, asking only for what's missing.

### `brief.md`

Free-form markdown. Recommended sections (see [`brand/campaigns/_template/brief.md`](../brand/campaigns/_template/brief.md) for the scaffold):

- **Objective** — Meta objective for this campaign.
- **Hypothesis** — one sentence: who, what offer, why we think it'll work.
- **Audience** — overrides for `brand.yaml` defaults if needed.
- **Schedule** — start/end (ISO 8601).
- **Budget** — daily budget in minor units.
- **Variants** — list of variant IDs (must match `copy.yaml`).
- **Success metric** — what "this worked" looks like at the 7-day mark.

### `copy.yaml`

Structured. One entry per variant; each variant becomes one ad inside the campaign's single ad set.

```yaml
link: "https://acme.example.com/landing"

variants:
  - id: "v1"
    primary_text: "Short hook that opens with the user's problem."
    headline: "One clear promise"
    description: "Optional sub-headline."
    cta_type: "LEARN_MORE"
    image_filename: "hero-v1.jpg"          # must exist in brand/assets/images/

  - id: "v2"
    primary_text: "Different angle. Maybe a testimonial."
    headline: "Different headline"
    description: ""
    cta_type: "LEARN_MORE"
    image_filename: "testimonial-v2.jpg"
```

`image_filename` is resolved against `manifest.json`. If the file is in `brand/assets/images/` but not yet in the manifest, `/ads-launch` calls `sync_brand_assets` first, then re-reads the manifest. If the file is missing from disk, `/ads-launch` stops.

### `ids.yaml`

Auto-managed by `/ads-campaign` and `/ads-launch`. It's the single source of truth for which Meta entities (campaign, ad sets, ads) belong to a given slug, so downstream skills can look them up by slug instead of parsing names.

```yaml
# Auto-managed by /ads-campaign and /ads-launch. Safe to read; don't hand-edit
# unless you know what you're doing — the skills append to this file.
slug: "summer-promo"
account_id: "act_1234567890"
campaign:
  id: "23851234567890123"
  name: "Acme | OUTCOME_SALES | 2026-06-01"
  objective: "OUTCOME_SALES"
  created_at: "2026-06-01T08:00:14Z"
adsets:
  - id: "23851234567890456"
    name: "site_visitors_30d"
    created_at: "2026-06-01T08:00:18Z"
ads:
  - id: "23851234567890789"
    name: "v1"
    creative_id: "23851234567899999"
    variant_id: "v1"
    created_at: "2026-06-01T08:00:22Z"
```

Design choices, explained:

- **Slug-scoped.** One `ids.yaml` per `brand/campaigns/<slug>/`. The slug is the user-facing identity for a hypothesis; the IDs are the Meta-side bindings.
- **One account per slug.** `account_id` is recorded so the skills can detect drift. If `brand.yaml` `account.id` changes, `/ads-campaign` and `/ads-launch` refuse to write to a slug bound to a different account — pick a new slug or switch accounts.
- **IDs are strings.** Meta entity IDs exceed `Number.MAX_SAFE_INTEGER`, so they're always quoted in YAML.
- **Append-only.** Existing `adsets[]` and `ads[]` entries are never reordered or rewritten — only appended to. This keeps the file diff-friendly and audit-friendly.
- **Created on demand, not by `_template`.** The file is *not* shipped in `brand/campaigns/_template/`; it's created on the first successful campaign creation. An empty `ids.yaml` would be ambiguous (does it mean "no campaign yet" or "I tried and failed"?).
- **Skills coexist via the file:**
  - `/ads-campaign <slug>` creates `campaign` + initial `adsets[]`, leaves `ads: []`.
  - `/ads-launch <slug>` either creates the file from scratch (one-shot mode) or reads it and appends new ads (after a scaffold). If it needs to add an ad set under an existing campaign, it appends to `adsets[]` too.
  - Read-only skills (`/ads-report`, `/ads-optimize`, `/ads-pause`) can use `ids.yaml` to filter by slug instead of parsing campaign names.
- **Failure handling.** If a skill hits a 404 on an ID stored here (entity deleted out-of-band in Ads Manager), it warns the user — it does NOT silently rewrite the file. Stale entries are the user's call to clean up.

### Worked example: `summer-promo`

**1. Scaffold the brief.**

```bash
cp -R brand/campaigns/_template brand/campaigns/summer-promo
```

**2. Edit `brand/campaigns/summer-promo/brief.md`:**

```markdown
## Objective
OUTCOME_SALES

## Hypothesis
Returning visitors who didn't buy last month will convert on a 15% discount push.

## Audience
- Custom audience: site_visitors_30d (id 23842...)
- Exclusions: purchasers_90d

## Schedule
Start: 2026-06-01T08:00:00-0300
End:   2026-06-08T23:59:00-0300

## Budget
Daily: 8000 (=$80/day)

## Variants
- v1 — hero shot of the bestselling product
- v2 — testimonial from a returning customer

## Success metric
CPA ≤ $25 by day 5; ROAS ≥ 3x.
```

**3. Edit `brand/campaigns/summer-promo/copy.yaml`:**

```yaml
link: "https://acme.example.com/summer?utm_term=returning"
variants:
  - id: "v1"
    primary_text: "Still thinking about it? 15% off this week only."
    headline: "Your summer kit, 15% off"
    cta_type: "SHOP_NOW"
    image_filename: "summer-hero.jpg"
  - id: "v2"
    primary_text: "\"Worth every euro\" — Lina, Lisbon."
    headline: "What people say"
    cta_type: "SHOP_NOW"
    image_filename: "summer-testimonial.jpg"
```

**4. Drop the images.**

Copy `summer-hero.jpg` and `summer-testimonial.jpg` into `brand/assets/images/`.

**5. Launch.**

```
/ads-launch summer-promo
```

The skill:

1. Reads `brand.yaml`, `voice.md`, `summer-promo/brief.md`, `summer-promo/copy.yaml`.
2. Notes the link already has a `utm_term`, so it appends `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` from the templates.
3. Looks up `summer-hero.jpg` and `summer-testimonial.jpg` in `manifest.json`. Both missing → calls `sync_brand_assets` → re-reads manifest.
4. Generates names: campaign = `Acme Co | OUTCOME_SALES | 2026-06-01`, ad set = `site_visitors_30d`, ads = `v1`, `v2`.
5. Creates campaign, ad set, 2 creatives, 2 ads — all PAUSED.
6. Writes `brand/campaigns/summer-promo/ids.yaml` with the campaign id, the ad set id, and both ad ids (with their `creative_id` and `variant_id` bindings).
7. Prints the IDs and Ads Manager URL.

**Alternative: scaffold first, attach creatives later.**

If you want the campaign live (PAUSED) before the creatives are final — e.g. you have the audience and budget locked in but the copy/imagery is still in review — split the launch:

```
/ads-campaign summer-promo    # creates campaign + adset PAUSED, writes ids.yaml
# ...later, once copy.yaml is filled in...
/ads-launch summer-promo      # reads ids.yaml, reuses campaign+adset, appends ads
```

The second run reads `ids.yaml`, sees the campaign already exists, and only creates the new creatives + ads — appending each to `ids.yaml` `ads[]`.

## What to commit

Defaults assume single-brand, single-account, single repo:

- **Always commit:** `brand/brand.yaml`, `brand/voice.md`, `brand/manifest.json`, all campaign briefs.
- **By default also commit:** `brand/assets/images/*` — so anyone cloning the repo can reproduce launches.
- **If you don't want binaries in git:** add `brand/assets/` to `.gitignore`. The `manifest.json` is still enough to drive launches as long as the recorded `image_hash` values are still valid in Meta (they don't expire).

`.env` is never committed (it's in `.gitignore` already and holds the access token).
