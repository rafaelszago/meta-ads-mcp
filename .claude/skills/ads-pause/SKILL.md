---
name: ads-pause
description: Bulk pause or resume Meta Ads entities by name pattern, status, or performance threshold (e.g. "pause all adsets with CPA > 50 over last 7d"). Always lists what will change before executing. Use when the user asks to "pause my ads", "stop campaigns matching X", "resume the Black Friday campaign", or mentions "/ads-pause".
allowed-tools: mcp__meta-ads__list_campaigns, mcp__meta-ads__list_adsets, mcp__meta-ads__list_ads, mcp__meta-ads__get_insights, mcp__meta-ads__pause_campaign, mcp__meta-ads__pause_adset, mcp__meta-ads__pause_ad, mcp__meta-ads__resume_campaign, mcp__meta-ads__resume_adset, mcp__meta-ads__resume_ad, Read
---

# ads-pause — Bulk pause/resume

Pause or resume campaigns, ad sets, or ads by criteria. Two-phase: preview, then confirm.

## Step 0: Load brand context

Read `brand/brand.yaml` if present. Use `naming_convention.*` to interpret user shorthand:
- "pause the summer-promo campaign" → match campaigns where the slug aligns with `naming_convention.campaign` tokens.
- When the user says "all traffic campaigns", parse `{objective}` from each campaign name using the template and filter accordingly.

## Inputs to gather

- **Action**: pause or resume
- **Level**: campaign, ad set, or ad
- **Criteria**: one or more of:
  - Name pattern (substring or regex)
  - Current status filter (e.g. only ACTIVE)
  - Performance threshold (e.g. CPA > X, CTR < Y, spend > Z over a date range)
  - Explicit list of IDs

## Steps

1. **Discover candidates**: call `list_campaigns` / `list_adsets` / `list_ads` and filter client-side by name/status criteria the user provided. Apply the naming-convention parser from step 0 when the user uses facet shorthand.
2. **If a performance threshold is in play**: call `get_insights` for the matching IDs (`level` matches the entity level, `date_preset` from user or default `last_7d`) and apply the threshold.
3. **Preview**: print a numbered list of the matched entities with their IDs, names, and the relevant metric values. Show the count.
4. **Confirm** with the user — explicit yes before executing. If a large number (>10) ask twice.
5. **Execute**: call `pause_*` or `resume_*` for each ID. Capture successes vs failures separately and report at the end.

## Output format

```
Matched 7 ad sets to PAUSE (criteria: name contains "Black Friday", status=ACTIVE):

  1. 23842... Black Friday – Lookalike 1% — CPA $48
  2. 23842... Black Friday – Broad         — CPA $72
  ...

Proceed? (yes/no)
```

After execution:
```
Paused 6/7. 1 failed:
  - 23842... Black Friday – Broad — Error: <message>
```

## Notes

- **Never act without confirmation**, even if the user's request seems unambiguous.
- For "resume" actions, remind the user that resuming starts spend immediately.
- If criteria match nothing, say so and stop — don't suggest broader criteria unless the user asks.
- Threshold examples to recognize:
  - "CPA > 50" → calculate from `spend / actions[purchase|lead]`
  - "CTR < 1%" → `ctr < 1`
  - "spent more than 100" → `spend > 100`
