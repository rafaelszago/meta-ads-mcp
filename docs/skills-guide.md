# Skills guide

Four project-scoped skills live under `.claude/skills/` and orchestrate the MCP tools into common workflows. Invoke a skill with `/<skill-name>` in Claude Code, or just describe what you want — Claude will pick the matching skill from its `description` frontmatter.

Each skill is grounded in `brand/brand.yaml` and `brand/voice.md` when present (see [`brand-workflow.md`](./brand-workflow.md)).

---

## `/ads-launch` — Guided campaign launch

**What it does.** Walks you through creating a complete ad — campaign → ad set → creative → ad — in one flow. Everything is created `PAUSED`. You flip status to `ACTIVE` in Ads Manager (or via `/ads-pause` resume) once you've reviewed.

**When to use it.** "launch a campaign", "create a new ad", "set up a Meta Ads campaign", `/ads-launch`, or `/ads-launch <slug>` to launch from a saved brief.

**Inputs it gathers.** The skill reads `brand/brand.yaml` and `brand/voice.md` first, then only asks for what's missing:

| Input | Pre-filled from `brand.yaml` if set | Otherwise asks |
| --- | --- | --- |
| Objective | `defaults.objective` | Yes |
| Daily budget (minor units) | `defaults.daily_budget_minor` | Yes |
| Billing event | `defaults.billing_event` | Yes |
| Countries / age / gender | `defaults.audience.*` | Yes |
| Interests / behaviors | — | Always asks |
| Page ID | `placements.page_id` | Yes |
| Instagram actor ID | `placements.instagram_actor_id` | Optional |
| CTA type | `defaults.cta_type` | Yes |
| Naming pattern | `naming_convention.{campaign,adset,ad}` | Falls back to `[goal] - YYYY-MM-DD - vN` |
| UTM params | `utm.*` | Skipped if the link already has UTM params |
| Image | Resolved from `brand/manifest.json` via filename in `copy.yaml` | Asks for image filename |
| Schedule | — | Always optional |

**What it doesn't do.**

- Does not flip any entity to `ACTIVE`. Everything stays PAUSED.
- Does not accept image paths outside `brand/assets/images/`. Use the dedicated `upload_image` tool directly if you need to push a one-off file from elsewhere.
- Does not upload videos. Pass an existing `video_id` if you need video creative.
- Does not create custom audiences or pixels. Those must exist before the launch.

**Customization.**

- `brand/brand.yaml` — the bulk of the defaults; see [`brand-workflow.md`](./brand-workflow.md) for the full schema.
- `brand/voice.md` — constrains primary text, headline, and description. Violations are flagged before creation.
- `brand/campaigns/<slug>/brief.md` + `copy.yaml` — when you invoke `/ads-launch <slug>`, the skill reads these and only asks for missing pieces.

**Example session.**

```
You:        /ads-launch summer-promo
Claude:     Loaded brand.yaml, voice.md, brief.md, copy.yaml.
            Defaults: OUTCOME_SALES, US, age 25–54, $50/day, CTA=SHOP_NOW.
            Variants in copy.yaml: v1 (hero), v2 (testimonial).
            Image bindings: hero-v1.jpg, testimonial-v2.jpg.
            Both filenames are in brand/manifest.json — no sync needed.

            Anything to override before I create everything PAUSED?
You:        bump the budget to $80/day, otherwise good
Claude:     [creates campaign, ad set, 2 creatives, 2 ads — all PAUSED]
            Campaign 23842... · Ad set 23842... · Ads 23842..., 23842...
            Ads Manager: https://business.facebook.com/adsmanager/...
```

---

## `/ads-report` — Performance snapshot

**What it does.** Generates a readable performance summary. Default range is yesterday + trailing 7 days. Tables by campaign and ad set, top/bottom performers by CTR and CPA. Optionally posts to Discord.

**When to use it.** "ads report", "how are my campaigns doing", "ad performance", `/ads-report`. Also good for scheduled runs (e.g. every morning via `/schedule`).

**Inputs it gathers.**

| Input | Pre-filled | Otherwise |
| --- | --- | --- |
| Currency symbol | `brand.yaml` `account.currency` | Falls back to `get_account_summary` |
| Grouping | `brand.yaml` `naming_convention.*` (parses out `{objective}`, `{audience}`, etc.) | Groups by raw campaign name |
| Date range | — | Default: yesterday + last 7d. Override with a custom range. |
| Discord post | `DISCORD_WEBHOOK_URL` env | Skipped silently if not set |

**What it doesn't do.**

- Does not mutate any entity.
- Does not invent metrics — if `actions` is missing for an objective, those columns are blank, not faked.
- Does not auto-post to Discord unless you ask for it (or it's running on a schedule).

**Customization.**

- `brand.yaml` `naming_convention.campaign` lets the report group "OUTCOME_TRAFFIC campaigns" together if your names follow `{brand} | {objective} | {date}`.
- Pass a specific date range in plain English ("last 14 days", "from 2026-04-01 to 2026-04-15") to override the defaults.

**Example session.**

```
You:        /ads-report
Claude:     ## Account — Last 7 days
            Spend: $352 · Impressions: 142,300 · Clicks: 1,890 · CTR: 1.33%
            ...
            ## Top performers (7d, by CTR)
            1. Retargeting – Visitors 30d   CTR 4.2%   ROAS 5.1x
            2. ...
            ## Underperformers (7d)
            1. Broad – Interest Bible       CPA $87 (account median $32)
```

---

## `/ads-optimize` — Analysis + recommendations

**What it does.** Reads 14 days of insights, surfaces patterns, and outputs an action checklist. **Does not execute any change.** You decide and use `/ads-pause`, `update_*`, or `/ads-launch` to act.

**When to use it.** "optimize my ads", "what should I change", "review my campaigns", `/ads-optimize`. Good for weekly cadence.

**Inputs it gathers.** Pure analysis — no questions unless you ask for a non-default range.

**What it surfaces.**

- **Creative fatigue** — ad sets with ≥30% CTR drop week-over-week (and prior CTR > 0.5%).
- **High spend, low return** — top-quartile spend AND (top-quartile CPA OR ROAS < 1.0).
- **Underspending winners** — bottom-half spend AND top-quartile CTR AND positive ROAS. Candidates for budget bump.
- **Zero-spend live** — `ACTIVE` ad sets with $0 in the last 7 days. Usually a delivery or billing issue.

**What it doesn't do.**

- Never mutates. Output is recommendations and a suggested-next-steps checklist.
- Doesn't recommend pausing brand-awareness campaigns based on CPA (wrong metric for the objective).
- Doesn't act on sparse data — if the account is new or under-funded, the skill says so and recommends waiting.

**Customization.**

- `brand/brand.yaml` `naming_convention.*` — used to group recommendations by audience / objective / variant so they line up with how you think about the account.
- `brand/voice.md` — when the skill drafts a sample replacement hook for a fatigued ad, it follows the voice rules.
- `config/optimization-targets.yaml` — thresholds (CTR kill %, CPC targets, frequency caps, scale rules). Copy from `config/optimization-targets.example.yaml` and tune. If absent, sensible defaults are used.

**Example session.**

```
You:        /ads-optimize
Claude:     ## Ads — Optimization review (last 14d)

            ### 🔻 Likely creative fatigue
            - "Lookalike 1% – v3": CTR 1.8% → 1.1% (-39%).
              Refresh suggestion (matches voice.md): "Plan your day in 10 minutes — free template."

            ### 🔴 High spend, low return
            - "Broad – Interest Bible": $420 spent, CPA $87 (median $32).
              Recommend: /ads-pause or tighten targeting.

            ### Suggested next steps
            1. [ ] Refresh creative for "Lookalike 1% – v3"
            2. [ ] /ads-pause "Broad – Interest Bible"
            3. [ ] Bump budget on "Retargeting – Visitors 30d" by 3x
```

---

## `/ads-pause` — Bulk pause/resume

**What it does.** Pauses or resumes campaigns, ad sets, or ads matching name patterns, status filters, or performance thresholds. Two-phase: preview, then confirm.

**When to use it.** "pause my ads", "stop campaigns matching X", "resume the Black Friday campaign", `/ads-pause`.

**Inputs it gathers.**

| Input | Description |
| --- | --- |
| Action | `pause` or `resume`. |
| Level | `campaign`, `adset`, or `ad`. |
| Name pattern | Substring or regex. Can use facet shorthand like "all traffic campaigns" if `naming_convention` is set. |
| Status filter | e.g. "only ACTIVE". |
| Performance threshold | e.g. "CPA > 50", "CTR < 1%", "spent more than 100" — calculated from `get_insights`. |
| Explicit IDs | Skip filtering and act on a fixed list. |

**What it doesn't do.**

- Never executes without explicit confirmation. If more than 10 entities match, it asks twice.
- Doesn't recover from partial failures silently — the final report lists successes and failures separately.
- Doesn't broaden criteria when nothing matches. It stops and tells you.

**Customization.**

- `brand/brand.yaml` `naming_convention.*` is used to parse "all traffic campaigns" or "all summer-promo ads" into actual matches based on your name template.

**Example session.**

```
You:        pause all adsets named "Black Friday" with CPA > 50 over last 7d
Claude:     Matched 7 ad sets to PAUSE (criteria: name contains "Black Friday",
            CPA > 50 over last 7d):

              1. 23842... Black Friday – Lookalike 1% — CPA $72
              2. 23842... Black Friday – Broad         — CPA $89
              ...

            Proceed? (yes/no)
You:        yes
Claude:     Paused 6/7. 1 failed:
              - 23842... Black Friday – Broad — Error: ...
```

---

## Combining skills

A typical weekly cadence:

| Day | Skill | Purpose |
| --- | --- | --- |
| Monday morning | `/ads-report` | Snapshot last week. Spot anomalies. |
| Monday | `/ads-optimize` | Get recommendations grounded in 14 days of data. |
| Monday/Tuesday | `/ads-pause` | Act on the losers from the optimize output. |
| Tuesday/Wednesday | `/ads-launch` (or `/ads-launch <slug>` from a brief) | Replace what you paused; test the next hypothesis. |
| Daily | `/ads-report` (scheduled) | Lightweight check-in. Post to Discord with `DISCORD_WEBHOOK_URL` set. |

Use [`/schedule`](https://docs.claude.com/en/docs/claude-code/slash-commands) to run `/ads-report` automatically each morning.
