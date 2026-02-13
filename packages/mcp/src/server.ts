/**
 * MCP Server Implementation
 *
 * Model Context Protocol server for AI coding tool integration.
 * Allows coding-usage to be queried and controlled via MCP.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * MCP server configuration
 */
interface McpServerConfig {
  name?: string;
  version?: string;
}

/**
 * Create MCP server
 */
export function createMcpServer(config: McpServerConfig = {}): McpServer {
  const server = new McpServer({
    name: config.name || "coding-usage",
    version: config.version || "0.1.0",
  });

  // List quota status
  server.registerTool(
    "list_quotas",
    {
      description: "List all quota rules and their current status",
    },
    async () => {
      // TODO: Query actual quota engine
      const quotas = [
        {
          provider: "openai",
          rule: "gpt-4-monthly",
          used: 1234567,
          limit: 10000000,
          percentage: 0.1234,
          freshness: "known",
        },
      ];

      return {
        content: [{ type: "text", text: JSON.stringify(quotas) }],
      };
    },
  );

  // Get provider info
  server.registerTool(
    "get_provider",
    {
      description: "Get information about a specific provider",
      inputSchema: z.object({
        providerId: z
          .string()
          .describe("Provider ID (e.g., openai, openrouter)"),
      }),
    },
    async ({ providerId }: { providerId: string }) => {
      // TODO: Query provider info
      const provider = {
        id: providerId,
        name: "OpenAI",
        category: "official",
        confidence: "high",
        supportedScopes: ["personal", "org"],
        description: "GPT-4, GPT-3.5 Turbo",
      };

      return {
        structuredContent: provider,
        content: [{ type: "text", text: JSON.stringify(provider) }],
      };
    },
  );

  // Add usage record
  server.registerTool(
    "add_usage",
    {
      description: "Add a usage record manually",
      inputSchema: z.object({
        provider: z.string(),
        totalTokens: z.number().optional(),
        costUsd: z.number().optional(),
        model: z.string().optional(),
      }),
    },
    async ({ provider }: { provider: string }) => {
      // TODO: Add to database
      const message = `Usage record added for ${provider}`;
      return {
        structuredContent: {
          success: true,
          message,
        },
        content: [{ type: "text", text: message }],
      };
    },
  );

  return server;
}

/**
 * Start MCP server with stdio transport
 */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
