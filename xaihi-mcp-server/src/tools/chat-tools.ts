import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';

export class MessageStore {
  private messages: { username: string; message: string; time: number }[] = [];
  private maxMessages = 50;

  add(username: string, message: string): void {
    this.messages.push({ username, message, time: Date.now() });
    while (this.messages.length > this.maxMessages) this.messages.shift();
  }

  getRecent(count = 10): string {
    const recent = this.messages.slice(-count);
    if (recent.length === 0) return "No recent messages";
    return recent.map(m => `[${m.username}]: ${m.message}`).join('\n');
  }
}

export function registerChatTools(factory: ToolFactory, getBot: () => mineflayer.Bot, store: MessageStore): void {
  factory.registerTool(
    "send_chat",
    "Send a chat message to the server",
    {
      message: z.string().max(256).describe("Message to send"),
    },
    async ({ message }) => {
      const bot = getBot();
      bot.chat(message);
      return factory.ok(`Sent: ${message}`);
    }
  );

  factory.registerTool(
    "read_chat",
    "Read recent chat messages",
    {
      count: z.coerce.number().min(1).max(50).optional().describe("Number of messages (default: 10)"),
    },
    async ({ count = 10 }) => {
      return factory.ok(store.getRecent(count));
    }
  );

  factory.registerTool(
    "whisper",
    "Send a private message to another player",
    {
      player: z.string().describe("Username to whisper"),
      message: z.string().max(256).describe("Message"),
    },
    async ({ player, message }) => {
      const bot = getBot();
      bot.whisper(player, message);
      return factory.ok(`Whispered to ${player}: ${message}`);
    }
  );
}
