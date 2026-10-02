import { z } from "zod";
import mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { ToolFactory } from '../tool-factory.js';

export function registerPositionTools(factory: ToolFactory, getBot: () => mineflayer.Bot): void {
  factory.registerTool(
    "get_position",
    "Get the bot's current position and look direction",
    {},
    async () => {
      const bot = getBot();
      const pos = bot.entity.position;
      const yaw = Math.round((bot.entity.yaw + 360) % 360);
      const pitch = Math.round(bot.entity.pitch);
      return factory.ok(`Position: (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}), facing yaw=${yaw}° pitch=${pitch}°`);
    }
  );

  factory.registerTool(
    "move_to",
    "Move to a position in the world. The bot will use pathfinding to navigate.",
    {
      x: z.coerce.number().describe("X coordinate"),
      y: z.coerce.number().describe("Y coordinate"),
      z: z.coerce.number().describe("Z coordinate"),
      range: z.coerce.number().min(0).optional().describe("How close to get (default: 1)"),
    },
    async ({ x, y, z, range = 1 }) => {
      const bot = getBot();
      await (bot as any).pathfinder.goto(new goals.GoalNear(x, y, z, range));
      return factory.ok(`Moved to near (${x}, ${y}, ${z})`);
    }
  );

  factory.registerTool(
    "look_at",
    "Make the bot look at a position or entity",
    {
      x: z.coerce.number().describe("X coordinate to look at"),
      y: z.coerce.number().describe("Y coordinate to look at"),
      z: z.coerce.number().describe("Z coordinate to look at"),
    },
    async ({ x, y, z }) => {
      const bot = getBot();
      await bot.lookAt(new Vec3(x, y, z), true);
      return factory.ok(`Looking at (${x}, ${y}, ${z})`);
    }
  );

  factory.registerTool(
    "move_in_direction",
    "Move in a direction for a duration",
    {
      direction: z.enum(['forward', 'back', 'left', 'right']).describe("Direction"),
      duration: z.coerce.number().min(100).max(10000).optional().describe("Milliseconds (default: 1000)"),
    },
    async ({ direction, duration = 1000 }) => {
      const bot = getBot();
      bot.setControlState(direction, true);
      await new Promise(r => setTimeout(r, duration));
      bot.setControlState(direction, false);
      return factory.ok(`Moved ${direction} for ${duration}ms`);
    }
  );

  factory.registerTool(
    "jump",
    "Make the bot jump once",
    {},
    async () => {
      const bot = getBot();
      bot.setControlState('jump', true);
      await new Promise(r => setTimeout(r, 300));
      bot.setControlState('jump', false);
      return factory.ok("Jumped");
    }
  );
}
