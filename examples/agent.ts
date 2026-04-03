/**
 * Simple AI agent that uses surf-mcp tools via Claude.
 *
 * Prerequisites:
 *   - ANTHROPIC_API_KEY env var
 *   - SURF_API_KEY env var
 *
 * Usage:
 *   bun run examples/agent.ts "What's the current BTC price and fear & greed index?"
 */

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool, MessageParam, ContentBlockParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";

const MODEL = "claude-sonnet-4-20250514";

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error("Usage: bun run examples/agent.ts <question>");
    process.exit(1);
  }

  // 1. Start the MCP server as a subprocess
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", "src/index.ts"],
    env: { ...process.env, SURF_API_KEY: process.env.SURF_API_KEY! },
  });

  const mcp = new Client({ name: "agent", version: "1.0.0" });
  await mcp.connect(transport);

  // 2. List available tools and convert to Claude format
  const { tools: mcpTools } = await mcp.listTools();
  const claudeTools: Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Tool["input_schema"],
  }));

  console.log(`Connected to surf-mcp (${mcpTools.length} tools)\n`);
  console.log(`Question: ${query}\n`);

  // 3. Agent loop
  const messages: MessageParam[] = [{ role: "user", content: query }];

  for (let turn = 0; turn < 10; turn++) {
    const response = await new Anthropic().messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: claudeTools,
      messages,
    });

    // Collect assistant content
    const assistantContent: ContentBlockParam[] = [];
    const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    for (const block of response.content) {
      if (block.type === "text") {
        assistantContent.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        assistantContent.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
        toolUses.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
      }
    }

    messages.push({ role: "assistant", content: assistantContent });

    // If no tool calls, we're done
    if (toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      console.log(text);
      break;
    }

    // 4. Execute tool calls via MCP
    const toolResults: ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      console.log(`  -> ${use.name}(${JSON.stringify(use.input)})`);
      const result = await mcp.callTool({
        name: use.name,
        arguments: use.input,
      });

      const content = result.content as Array<{ type: string; text?: string }>;
      const text = content
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n");

      // Truncate large responses to stay within context
      const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n...(truncated)" : text;

      toolResults.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: truncated,
        is_error: (result.isError as boolean) ?? false,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  await mcp.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
