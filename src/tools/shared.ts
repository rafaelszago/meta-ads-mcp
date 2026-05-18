import type { z } from "zod"
import { defaultAccountId, MetaApiError } from "../meta-client"

export type ToolDef = {
  name: string
  description: string
  inputSchema: z.ZodTypeAny
  handler: (input: unknown) => Promise<unknown>
}

export function resolveAccount(input: { account_id?: string }): string {
  return input.account_id ?? defaultAccountId()
}

export function asTextResult(
  value: unknown,
  warning?: string | null,
): {
  content: { type: "text"; text: string }[]
  isError?: boolean
} {
  const body = JSON.stringify(value, null, 2)
  const text = warning ? `⚠️  ${warning}\n\n${body}` : body
  return { content: [{ type: "text", text }] }
}

export function asErrorResult(err: unknown): {
  content: { type: "text"; text: string }[]
  isError: true
} {
  if (err instanceof MetaApiError) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: err.message,
              status: err.status,
              code: err.code,
              subcode: err.subcode,
              fbtrace_id: err.fbtrace,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }
  const msg = err instanceof Error ? err.message : String(err)
  return {
    content: [{ type: "text", text: `Error: ${msg}` }],
    isError: true,
  }
}
