---
name: ads-optimize
description: Analyze the last 14 days of Meta Ads performance and surface recommendations — creative fatigue, high-spend/low-return ad sets, underspending winners. Outputs an action checklist but does NOT mutate anything. Use when the user asks to "optimize my ads", "what should I change", "review my campaigns", or mentions "/ads-optimize".
allowed-tools: mcp__meta-ads__list_campaigns, mcp__meta-ads__list_adsets, mcp__meta-ads__get_insights, Read
---

# ads-optimize — Analysis + recommendations

Pure analysis skill. Reads insights, surfaces patterns, recommends actions. Does **not** execute changes — the user runs `ads-pause` or `update_*` tools themselves.

## Step 0: Load brand + targets context

- Read `brand/brand.yaml` if present. Use `naming_convention.*` to parse campaign/ad set names into facets (objective, audience, variant) so groupings line up with how the user thinks about the account.
- Read `brand/voice.md` if present. When recommending creative refreshes, match the brand's vocabulary and respect the do/don't list.
- Read `config/optimization-targets.yaml` if present for thresholds (CTR kill, CPC targets, frequency caps, scale rules, learning-phase windows). Fall back to defaults below.

## Steps

1. **Last 7d aggregate** at ad set level — `get_insights` with `level: 'adset'`, `date_preset: 'last_7d'`, fields `adset_name,campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,purchase_roas`.
2. **Prior 7d aggregate** (days 8–14) — same call, `time_range: { since: <14d ago>, until: <8d ago> }`. Used for week-over-week CTR comparison (fatigue detection).
3. **Compute deltas**:
   - **CTR fatigue**: ad sets where CTR dropped ≥ 30% week-over-week AND prior CTR was meaningful (>0.5%).
   - **High-spend, low-return**: spend in top quartile AND (CPA in top quartile OR purchase_roas < 1.0 if e-com).
   - **Underspending winners**: low spend (bottom half) AND strong CTR (top quartile) AND positive ROAS — candidates for budget increase.
   - **Zero-spend live**: status ACTIVE but spend = 0 in last 7d — likely a delivery/billing issue.

## Output format

```
## Ads — Optimization review (last 14d)

### 🔻 Likely creative fatigue (CTR ↓ week-over-week)
- "Lookalike 1% – v3" CTR 1.8% → 1.1% (-39%). Consider refreshing the creative.

### 🔴 High spend, low return (last 7d)
- "Broad – Interest Bible" $420 spent, CPA $87 (vs account median $32).
  Recommend: pause or tighten audience.

### 🟢 Underspending winners (last 7d)
- "Retargeting – Visitors 30d" CTR 4.2%, ROAS 5.1x, only $48 spent.
  Recommend: increase daily budget 2-3x.

### ⚠️ Zero-spend live ad sets
- "Conversion – Site purchases" ACTIVE but $0 spent — investigate.

### Suggested next steps
1. [ ] Refresh creative for fatigued ad sets above
2. [ ] Pause underperformers: `/ads-pause` for "Broad – Interest Bible"
3. [ ] Bump budget on winners (3x for the strongest)
```

## Notes

- **Never recommend changes without data.** If 14d data is sparse (account is new, low spend), say so and recommend running longer before optimizing.
- Quartile thresholds are relative to the account's own distribution, not absolute numbers.
- Use the account's currency from `brand/brand.yaml` `account.currency` or `get_account_summary` for display.
- Don't suggest pausing brand awareness campaigns based on CPA — those don't optimize for conversions.
- Cross-reference `campaign_name` so the user can see which campaign each ad set belongs to.
- When recommending fresh creative, draft 1-2 example hooks in `voice.md`'s tone so the user can copy/paste.
