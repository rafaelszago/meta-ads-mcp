const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0"
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: number | null,
    public readonly subcode: number | null,
    public readonly fbtrace: string | null,
    public readonly raw: unknown,
  ) {
    super(message)
    this.name = "MetaApiError"
  }
}

function token(): string {
  const t = process.env.META_ACCESS_TOKEN
  if (!t) throw new Error("META_ACCESS_TOKEN is not set. Copy .env.example to .env and fill it in.")
  return t
}

export function defaultAccountId(): string {
  const id = process.env.META_AD_ACCOUNT_ID
  if (!id)
    throw new Error("META_AD_ACCOUNT_ID is not set. Use the form act_<digits> (with the prefix).")
  return id
}

type ParamValue = string | number | boolean | undefined | null

function buildQuery(params?: Record<string, ParamValue>): string {
  const u = new URLSearchParams()
  u.set("access_token", token())
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue
      u.set(k, String(v))
    }
  }
  return u.toString()
}

async function handle(res: Response): Promise<unknown> {
  const text = await res.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    throw new MetaApiError(
      `Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
      res.status,
      null,
      null,
      null,
      text,
    )
  }
  if (!res.ok || (body && typeof body === "object" && "error" in body)) {
    const err = (
      body as {
        error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string }
      }
    )?.error
    throw new MetaApiError(
      err?.message ?? `HTTP ${res.status}`,
      res.status,
      err?.code ?? null,
      err?.error_subcode ?? null,
      err?.fbtrace_id ?? null,
      body,
    )
  }
  return body
}

export async function metaGet(path: string, params?: Record<string, ParamValue>): Promise<unknown> {
  const url = `${GRAPH_BASE}/${path.replace(/^\/+/, "")}?${buildQuery(params)}`
  const res = await fetch(url, { method: "GET" })
  return handle(res)
}

export async function metaPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const url = `${GRAPH_BASE}/${path.replace(/^\/+/, "")}`
  const form = new URLSearchParams()
  form.set("access_token", token())
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue
    form.set(k, typeof v === "string" ? v : JSON.stringify(v))
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })
  return handle(res)
}

export async function metaDelete(path: string): Promise<unknown> {
  const url = `${GRAPH_BASE}/${path.replace(/^\/+/, "")}?${buildQuery()}`
  const res = await fetch(url, { method: "DELETE" })
  return handle(res)
}
