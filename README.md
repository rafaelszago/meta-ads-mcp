# meta-ads-mcp

A local [Model Context Protocol](https://modelcontextprotocol.io) server for managing a Meta Ads account from [Claude Code](https://claude.com/claude-code) — plus four project-scoped skills that orchestrate common workflows (launch, report, optimize, pause) and a `brand/` directory that grounds every skill in your brand voice, defaults, and assets.

> Not affiliated with, endorsed by, or sponsored by Meta Platforms, Inc. "Meta", "Facebook", and "Instagram" are trademarks of Meta Platforms, Inc. This project wraps the public Meta Marketing API and is provided as-is under the MIT License.

## Why this exists

Meta ships an official MCP at `mcp.facebook.com/ads`, but the rollout is phased and many ad accounts (and many Claude clients' OAuth callbacks) are not yet on the allowlist. This server wraps the Meta Marketing API directly using a System User access token, so any account with API access can drive its ads from Claude today. When Meta enables your account on the official MCP, swap by editing `.mcp.json` — see [Swap to the official MCP](#swap-to-the-official-mcp).

## Quickstart

1. **Set up credentials** — generate a System User token, copy `.env.example` to `.env`, fill it in.
2. **Install** — `bun install`, then restart Claude Code in this directory.
3. **Scaffold the brand context** — `cp brand/brand.yaml.example brand/brand.yaml`, fill it in.
4. **Launch your first PAUSED campaign** — drop an image in `brand/assets/images/`, run `/ads-launch` in Claude Code.

Full walkthrough: [`docs/getting-started.md`](docs/getting-started.md).

## Documentation

Everything end-user lives under [`docs/`](docs/):

- [`getting-started.md`](docs/getting-started.md) — token, env, install, first launch.
- [`tools-reference.md`](docs/tools-reference.md) — all 24 MCP tools with inputs, returns, examples.
- [`skills-guide.md`](docs/skills-guide.md) — `/ads-campaign`, `/ads-launch`, `/ads-report`, `/ads-optimize`, `/ads-pause`, and the weekly cadence.
- [`brand-workflow.md`](docs/brand-workflow.md) — `brand/brand.yaml` schema, `voice.md`, the asset manifest, campaign briefs.
- [`troubleshooting.md`](docs/troubleshooting.md) — error codes, recovery, debugging.
- [`flip-fb-app-to-live.md`](docs/flip-fb-app-to-live.md) — required before `create_creative` / `create_ad` work.

## What's in the box

- **24 MCP tools** across Campaigns, Ad Sets, Ads, Creatives, Insights, and Brand. Full reference: [`docs/tools-reference.md`](docs/tools-reference.md).
- **5 project-scoped skills** under `.claude/skills/`:
  - `/ads-campaign` — scaffold a campaign + ad set(s) PAUSED, persist IDs to `brand/campaigns/<slug>/ids.yaml`.
  - `/ads-launch` — guided campaign creation, everything PAUSED. Reuses `ids.yaml` if scaffolded.
  - `/ads-report` — performance snapshot (yesterday + last 7d), optional Discord post.
  - `/ads-optimize` — analysis + recommendations, never mutates.
  - `/ads-pause` — bulk pause/resume by pattern, status, or performance threshold.

  Per-skill detail: [`docs/skills-guide.md`](docs/skills-guide.md).
- **`brand/` directory** — `brand.yaml`, `voice.md`, asset manifest, per-campaign briefs. Skills read from it so launches stop re-asking the same questions. Detail: [`docs/brand-workflow.md`](docs/brand-workflow.md).

### Safety behavior

- All `create_*` and `update_*` tools default `status` to `PAUSED`.
- Passing `status: 'ACTIVE'` is allowed; the response includes a soft warning string. No hard caps.
- Budgets are passed in **minor units** (cents) — e.g. $50/day = `5000`.

## Swap to the official MCP

When Meta enables your account on their official MCP, replace `.mcp.json` with:

```json
{
  "mcpServers": {
    "meta-ads": {
      "type": "http",
      "url": "https://mcp.facebook.com/ads"
    }
  }
}
```

Since both servers use the `meta-ads` key, the skills' `allowed-tools` (`mcp__meta-ads__*`) keep working as long as the official MCP exposes matching tool names.

## Development

```bash
bun run dev          # watch mode
bun run typecheck    # tsc --noEmit
bun run lint:fix     # biome check --write
```

Stack: Bun + TypeScript (strict, ESNext, bundler resolution) + Biome + Zod + `@modelcontextprotocol/sdk`.

## Out of scope (v2+)

- Custom audiences
- Product catalogs / Dynamic Product Ads
- Pixel / Conversions API event sending
- Targeting interest search
- A/B test setup
- Video asset upload (`upload_image` covers PNG/JPG; videos still expect a pre-uploaded `video_id`)

## License

MIT — see [`LICENSE`](LICENSE).
