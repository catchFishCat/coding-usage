/**
 * MCP Server Implementation
 *
 * Model Context Protocol server for AI coding tool integration.
 * Allows coding-usage to be queried and controlled via MCP.
 */

import { Server } from '@modelcontextprotocol/sdk';

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
export function createMcpServer(config: McpServerConfig = {}): Server {
  const server = new Server({
    name: config.name || 'coding-usage',
    version: config.version || '0.1.0',
  });

  // List quota status
  server.tool(
    'list_quotas',
    'List all quota rules and their current status',
    {
      inputSchema: {
        type: 'object',
        properties: {},
      },
      outputSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            rule: { type: 'string' },
            used: { type: 'number' },
            limit: { type: 'number' },
            percentage: { type: 'number' },
            freshness: { type: 'string' },
          },
        },
      },
    },
    async () => {
      // TODO: Query actual quota engine
      return [
        {
          provider: 'openai',
          rule: 'gpt-4-monthly',
          used: 1234567,
          limit: 10000000,
          percentage: 0.1234,
          freshness: 'known',
        },
      ];
    }
  );

  // Get provider info
  server.tool(
    'get_provider',
    'Get information about a specific provider',
    {
      inputSchema: {
        type: 'object',
        properties: {
          providerId: {
            type: 'string',
            description: 'Provider ID (e.g., openai, openrouter)',
          },
        },
        required: ['providerId'],
      },
    },
    async ({ providerId }) => {
      // TODO: Query provider info
      return {
        id: providerId,
        name: 'OpenAI',
        category: 'official',
        confidence: 'high',
        supportedScopes: ['personal', 'org'],
        description: 'GPT-4, GPT-3.5 Turbo',
      };
    }
  );

  // Add usage record
  server.tool(
    'add_usage',
    'Add a usage record manually',
    {
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string' },
          totalTokens: { type: 'number' },
          costUsd: { type: 'number' },
          model: { type: 'string' },
        },
        required: ['provider'],
      },
    },
    async ({ provider: _provider, totalTokens: _totalTokens, costUsd: _costUsd, model: _model }) => {
      // TODO: Add to database
      return {
        success: true,
        message: `Usage record added for ${_provider}`,
      };
    }
  );

  return server;
}

/**
 * Start MCP server with stdio transport
 */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();

  const stdio = new StdioServer({
    server,
    name: 'coding-usage-mcp',
  });

  await stdio.start();
}
