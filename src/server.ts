#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { allTools } from "./tools/index"
import { asErrorResult } from "./tools/shared"

const server = new Server({ name: "meta-ads", version: "0.1.0" }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: z.toJSONSchema(t.inputSchema) as Record<string, unknown>,
  })),
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = allTools.find((t) => t.name === req.params.name)
  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
      isError: true,
    }
  }
  try {
    const parsed = tool.inputSchema.parse(req.params.arguments ?? {})
    const result = await tool.handler(parsed)
    return result as Awaited<ReturnType<typeof tool.handler>> as never
  } catch (err) {
    return asErrorResult(err)
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
