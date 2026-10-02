import { z } from "zod";
import { ToolFactory } from '../tool-factory.js';
import { BotConnection, BotConfig } from '../bot-connection.js';

export function registerConnectionTools(factory: ToolFactory, connection: BotConnection): void {
  factory.registerTool(
    "login",
    "Log in to a Minecraft server as the bot and wait until it spawns. Without arguments, uses the startup config. Only works when logged out.",
    {
      host: z.string().optional().describe("Minecraft server host"),
      port: z.coerce.number().min(1).max(65535).optional().describe("Minecraft server port"),
      username: z.string().optional().describe("Bot username"),
      mc_version: z.string().optional().describe("Minecraft version, e.g. '1.21.5'"),
    },
    async (overrides: { host?: string; port?: number; username?: string; mc_version?: string }) => {
      const partial: Partial<BotConfig> = {};
      if (overrides.host !== undefined) partial.host = overrides.host;
      if (overrides.port !== undefined) partial.port = overrides.port;
      if (overrides.username !== undefined) partial.username = overrides.username;
      if (overrides.mc_version !== undefined) partial.mcVersion = overrides.mc_version;

      const result = await connection.login(partial);
      if (!result.ok) return factory.err(result.error!);
      const cfg = connection.getConfig();
      return factory.ok(`Logged in as ${cfg.username} on ${cfg.host}:${cfg.port} (${cfg.mcVersion})`);
    },
    { skipConnectionCheck: true }
  );

  factory.registerTool(
    "logout",
    "Log out from the Minecraft server. The bot leaves the game and stays offline until login is called again.",
    {},
    async () => {
      const wasActive = connection.isActive();
      connection.disconnect();
      return factory.ok(wasActive ? "Logged out from the Minecraft server." : "Was not logged in; nothing to do.");
    },
    { skipConnectionCheck: true }
  );
}
