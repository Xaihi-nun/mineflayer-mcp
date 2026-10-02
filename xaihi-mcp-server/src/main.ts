#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseConfig } from './config.js';
import { BotConnection } from './bot-connection.js';
import { ToolFactory } from './tool-factory.js';
import { MessageStore, registerChatTools } from './tools/chat-tools.js';
import { registerPositionTools } from './tools/position-tools.js';
import { registerBlockTools } from './tools/block-tools.js';
import { registerInventoryTools } from './tools/inventory-tools.js';
import { registerEntityTools } from './tools/entity-tools.js';
import { registerConnectionTools } from './tools/connection-tools.js';

function log(level: 'info' | 'warn' | 'error', message: string): void {
  const prefix = `[${level.toUpperCase()}] ${new Date().toISOString()}`;
  console.error(`${prefix} ${message}`);
}

async function main(): Promise<void> {
  // stdout is the MCP JSON-RPC channel; force stray console.log output
  // (mineflayer internals) onto stderr so it cannot corrupt the protocol stream
  console.log = (...args: unknown[]) => console.error(...args);

  const config = parseConfig();
  const messageStore = new MessageStore();

  const connection = new BotConnection(
    config,
    {
      onLog: log,
      onChatMessage: (username, message) => messageStore.add(username, message),
    }
  );

  // The bot does not auto-connect on startup; use the login tool to join a server.

  const server = new McpServer({
    name: "xaihi-minecraft-mcp-server",
    version: "1.1.0"
  });

  const factory = new ToolFactory(server, connection);
  const getBot = () => connection.getBotOrFail();

  // Register all tools
  registerConnectionTools(factory, connection);
  registerPositionTools(factory, getBot);
  registerBlockTools(factory, getBot);
  registerInventoryTools(factory, getBot);
  registerChatTools(factory, getBot, messageStore);
  registerEntityTools(factory, getBot);

  // Cleanup on disconnect
  process.stdin.on('end', () => {
    connection.cleanup();
    log('info', 'MCP client disconnected, shutting down');
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('info', 'Xaihi Minecraft MCP server started');
}

main().catch((error) => {
  log('error', `Fatal: ${error}`);
  process.exit(1);
});
