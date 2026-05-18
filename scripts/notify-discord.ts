#!/usr/bin/env bun
/**
 * Post a message to a Discord channel via webhook.
 *
 * Usage:
 *   echo "markdown body" | bun run scripts/notify-discord.ts --title "Daily Ads Report"
 *   bun run scripts/notify-discord.ts --title "Title" --content "body"
 *   bun run scripts/notify-discord.ts --json '{"content":"hi","embeds":[...]}'
 *
 * Reads DISCORD_WEBHOOK_URL from the environment.
 *
 * Modes:
 *   - --title + stdin (or --content): wraps body in a single embed (description, max 4096 chars).
 *   - --json <payload>: posts the raw Discord webhook JSON payload as-is.
 *   - bare stdin (no flags): posts as plain content (max 2000 chars).
 *
 * Exit codes: 0 ok, 1 usage error, 2 transport/HTTP error.
 */

type Args = {
  title?: string
  content?: string
  color?: number
  json?: string
}

function parseArgs(argv: string[]): Args {
  const out: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--title") out.title = argv[++i]
    else if (a === "--content") out.content = argv[++i]
    else if (a === "--color") out.color = Number(argv[++i])
    else if (a === "--json") out.json = argv[++i]
    else if (a === "-h" || a === "--help") {
      console.log(
        "usage: bun run scripts/notify-discord.ts [--title T] [--content C | stdin] [--color N] [--json PAYLOAD]",
      )
      process.exit(0)
    } else {
      console.error(`Unknown argument: ${a}`)
      process.exit(1)
    }
  }
  return out
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return ""
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString("utf8").trim()
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const webhook = process.env.DISCORD_WEBHOOK_URL
  if (!webhook) {
    console.error("DISCORD_WEBHOOK_URL is not set. Add it to .env.")
    process.exit(1)
  }

  const stdin = await readStdin()
  const body = args.content ?? stdin

  let payload: Record<string, unknown>
  if (args.json) {
    try {
      payload = JSON.parse(args.json)
    } catch (err) {
      console.error("Invalid --json payload:", (err as Error).message)
      process.exit(1)
    }
  } else if (args.title) {
    if (!body) {
      console.error("Provide body via --content or stdin when using --title.")
      process.exit(1)
    }
    payload = {
      embeds: [
        {
          title: truncate(args.title, 256),
          description: truncate(body, 4096),
          color: args.color ?? 0x5865f2, // Discord blurple
          timestamp: new Date().toISOString(),
        },
      ],
    }
  } else if (body) {
    payload = { content: truncate(body, 2000) }
  } else {
    console.error("Nothing to post. Pass --content, --json, or pipe stdin.")
    process.exit(1)
  }

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    console.error(`Discord webhook failed: HTTP ${res.status} ${text.slice(0, 300)}`)
    process.exit(2)
  }

  console.log("ok")
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(2)
})
