---
name: ads-report
description: Produce a performance snapshot for the Meta Ads account — yesterday plus trailing 7 days by default, grouped by campaign and ad set, with top/bottom performers by CTR and CPA. Use when the user asks for an "ads report", "how are my campaigns doing", "ad performance", or mentions "/ads-report".
allowed-tools: mcp__meta-ads__get_account_summary, mcp__meta-ads__get_insights, mcp__meta-ads__list_campaigns, mcp__meta-ads__list_adsets, Read
---

# ads-report — Performance snapshot

Generate a readable performance summary. Default range: yesterday + trailing 7 days. User can override.

## Step 0: Load brand context

Read `brand/brand.yaml` if present. Use:
- `account.currency` for the spend/CPC currency symbol.
- `naming_convention.*` to parse names into facets (objective, audience, variant) so report groupings make sense. If the convention defines `campaign: "{brand} | {objective} | {date}"`, group the report by `{objective}` first; otherwise group by raw campaign name.

## Inputs

If the user didn't specify, default to:
- `date_preset`: `yesterday` for the "yesterday" block
- `date_preset`: `last_7d` for the "trailing 7d" block

If they specified a custom range, use `time_range: { since, until }` (YYYY-MM-DD).

## Steps

1. **Account totals** — call `mcp__meta-ads__get_account_summary` once with `date_preset: 'last_7d'` for context.
2. **Yesterday's spend** — `mcp__meta-ads__get_insights` with `level: 'campaign'`, `date_preset: 'yesterday'`, fields including `campaign_name,spend,impressions,clicks,ctr,cpc,actions,purchase_roas`.
3. **Trailing 7d by campaign** — same call with `date_preset: 'last_7d'`.
4. **Trailing 7d by ad set** — `level: 'adset'`, `date_preset: 'last_7d'`, include `adset_name,campaign_name`.

## Output format

Use markdown tables. Example structure:

```
## Account — Last 7 days
Spend: X · Impressions: Y · Clicks: Z · CTR: A% · CPC: B

## Campaigns — Yesterday
| Campaign | Spend | Impr | CTR | CPC | ROAS |
| ... | ... | ... | ... | ... | ... |

## Campaigns — Last 7 days
[same shape]

## Top performers (7d, by CTR)
[top 5 ad sets]

## Underperformers (7d, by CPA or low CTR)
[bottom 5 ad sets, flag if CPA > threshold the user mentioned]
```

## Notes

- Use the account's currency symbol from `brand.yaml` (`account.currency`) or `get_account_summary` when formatting spend/CPC.
- If `actions` is present, surface relevant action types (`onsite_conversion.purchase`, `lead`, `link_click`) — these vary by objective.
- If `purchase_roas` exists, show it as a multiplier (e.g. `3.2x`).
- Skip campaigns/ad sets with zero spend in the period unless user asks for completeness.
- If the account has no active campaigns, say so plainly — don't fabricate a report.

## Discord posting (optional)

If `DISCORD_WEBHOOK_URL` is set in `.env` AND the user asked to post the report (or this is running on a schedule), pipe the rendered markdown to the helper after showing the report to the user:

```bash
printf '%s' "$REPORT_MARKDOWN" | bun run scripts/notify-discord.ts --title "Ads Report — $(date +%Y-%m-%d)"
```

The script truncates to Discord's 4096-char embed limit. If the report exceeds that, post a condensed version (account totals + top/bottom 3) instead of full tables. If the env var is not set, skip silently — don't prompt the user to configure it unless they explicitly asked to post.
