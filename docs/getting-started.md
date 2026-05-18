# Getting started

This walks through everything from "fresh clone" to "first PAUSED campaign in Ads Manager". Budget about 20 minutes — the slow part is generating the Meta access token.

## Prerequisites

- **Bun ≥ 1.0** — `curl -fsSL https://bun.sh/install | bash`
- **Business Manager admin** — you need admin role on the Meta business that owns the ad account.
- **An ad account** in that business with API access.
- **A Facebook developer app** linked to the business, with the Marketing API product enabled. Create one at [developers.facebook.com/apps](https://developers.facebook.com/apps) if you don't have one.
- **Claude Code** installed, since this project is an MCP server consumed from a Claude Code session.

## 1. Generate a System User access token

System User tokens are long-lived (no 60-day expiration) and survive personnel changes. That's why we use them instead of personal user tokens.

1. Go to [business.facebook.com](https://business.facebook.com) → select your Business Manager.
2. **Settings → Users → System Users → Add**. Name it (e.g. `ads-mcp`), assign role **Admin**.
3. **Add Assets → Ad Accounts**, check the ad account you want to manage, grant **Manage ad account**.
4. **Generate New Token**:
   - Pick your Meta developer app.
   - Permissions (see table below).
   - Token expiration: **Never**.
   - Click Generate. **Copy the token immediately — Meta only shows it once.**

### Required permissions

| Scope | Why |
| --- | --- |
| `ads_management` | Create/update/pause campaigns, ad sets, ads, creatives. |
| `ads_read` | List + get for all entities. Read insights. |
| `business_management` | Resolve the business that owns the ad account. |
| `read_insights` | Performance metrics (`get_insights`, `get_account_summary`). |
| `pages_manage_ads` | Required to attach creatives to a Facebook Page. |
| `pages_read_engagement` | Required when creatives reference a Page's posts. |

> **Note:** If your developer app is still in **Development mode**, reads + non-creative writes work, but `create_creative` and `create_ad` will fail with `subcode 1885183`. Flip the app to Live before running `/ads-launch` end-to-end — see [`flip-fb-app-to-live.md`](./flip-fb-app-to-live.md).

## 2. Configure environment

```bash
cp .env.example .env
# edit .env and paste your token + ad account id
```

Required:

| Var | Example | Notes |
| --- | --- | --- |
| `META_ACCESS_TOKEN` | `EAAB...` | The System User token from step 1. Never commit. |
| `META_AD_ACCOUNT_ID` | `act_1234567890` | Ad account id **including the `act_` prefix**. |

Optional:

| Var | Default | Purpose |
| --- | --- | --- |
| `META_GRAPH_VERSION` | `v21.0` | Pin a specific Graph API version. |
| `DISCORD_WEBHOOK_URL` | — | Lets `/ads-report` post to Discord. |

`META_AD_ACCOUNT_ID` is also mirrored into `brand/brand.yaml` (`account.id`) so skills can read it without env access. The runtime account always comes from the env var; `brand.yaml` is for skill grounding.

## 3. Install and verify the MCP server

```bash
bun install
bun run src/server.ts < /dev/null    # should exit cleanly with no output
```

Then restart Claude Code (or any session) inside this directory. The project-scoped `.mcp.json` wires the server up automatically.

```bash
claude mcp list
# meta-ads: stdio - ✓ Connected
```

If you see `✗ Failed to connect`, see [`troubleshooting.md`](./troubleshooting.md).

## 4. First launch (5-minute path)

The fastest way to confirm the whole pipeline works end-to-end is to launch a PAUSED throwaway campaign.

**4.1 Set up the brand context**

```bash
cp brand/brand.yaml.example brand/brand.yaml
cp brand/voice.md.example   brand/voice.md
```

Open `brand/brand.yaml` and fill at minimum:

```yaml
account:
  id: "act_1234567890"          # match your META_AD_ACCOUNT_ID
placements:
  page_id: "1234567890123456"   # the Facebook Page that will own the post
defaults:
  audience:
    countries: ["US"]           # or your market
naming_convention:
  campaign: "{brand} | {objective} | {date}"
```

Leave `voice.md` alone for now; the example tone works for a smoke test.

**4.2 Drop a test image**

Copy any `.jpg` or `.png` you want to use as the ad image into `brand/assets/images/`. A square 1080×1080 photo is a safe default. Name it something memorable like `smoke-test.jpg`.

**4.3 Launch**

In Claude Code, in this directory, run:

```
/ads-launch
```

The skill will:

1. Read `brand.yaml` and `voice.md`, pre-filling page id and audience defaults.
2. Ask you for anything missing (objective, budget, headline, primary text, link).
3. Call `sync_brand_assets` to upload `smoke-test.jpg` to your Meta ad account and record its `image_hash` in `brand/manifest.json`.
4. Create the campaign, ad set, creative, and ad — all in `PAUSED` status.
5. Print the IDs and an Ads Manager URL.

Open the Ads Manager URL. Your throwaway campaign should be visible, paused, with the image attached. Delete it from Ads Manager once you're satisfied.

> If the launch fails partway through (e.g. on `create_creative`), the campaign and ad set already created stay around as PAUSED. Re-run `/ads-launch` after fixing the issue, or delete the orphans manually.

## Where to go next

- [`skills-guide.md`](./skills-guide.md) — what `/ads-launch`, `/ads-report`, `/ads-optimize`, and `/ads-pause` do, and the weekly cadence that ties them together.
- [`brand-workflow.md`](./brand-workflow.md) — full `brand.yaml` schema, how `voice.md` shapes generated copy, the asset manifest contract, and per-campaign briefs.
- [`tools-reference.md`](./tools-reference.md) — every MCP tool with its inputs, returns, and a usage example. Useful when you want to drive the API directly instead of going through a skill.
- [`troubleshooting.md`](./troubleshooting.md) — error codes and recovery steps.
