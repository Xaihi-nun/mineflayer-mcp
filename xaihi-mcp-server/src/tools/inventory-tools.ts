import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';

export function registerInventoryTools(factory: ToolFactory, getBot: () => mineflayer.Bot): void {
  factory.registerTool(
    "list_inventory",
    "List all items in the bot's inventory",
    {},
    async () => {
      const bot = getBot();
      const items = bot.inventory.items() || [];
      if (items.length === 0) return factory.ok("Inventory is empty");

      const grouped: Record<string, number> = {};
      for (const item of items) {
        if (!item.name) continue;
        grouped[item.name] = (grouped[item.name] || 0) + item.count;
      }

      const list = Object.entries(grouped)
        .map(([name, count]) => `${name} x${count}`)
        .join(', ');
      return factory.ok(`Inventory: ${list}`);
    }
  );

  factory.registerTool(
    "get_held_item",
    "Get the item currently held by the bot",
    {},
    async () => {
      const bot = getBot();
      const held = bot.heldItem;
      if (!held) return factory.ok("No item held");
      return factory.ok(`Holding: ${held.name} x${held.count}`);
    }
  );

  factory.registerTool(
    "select_item",
    "Select an item from inventory",
    {
      name: z.string().describe("Item name to select"),
    },
    async ({ name }) => {
      const bot = getBot();
      const item = bot.inventory.items().find(i => i.name === name);
      if (!item) return factory.err(`Item "${name}" not found in inventory`);
      await bot.equip(item, 'hand');
      return factory.ok(`Selected: ${name}`);
    }
  );

  factory.registerTool(
    "equip_item",
    "Equip an item to a slot",
    {
      name: z.string().describe("Item name to equip"),
      slot: z.enum(['hand', 'head', 'chest', 'legs', 'feet']).describe("Equipment slot"),
    },
    async ({ name, slot }) => {
      const bot = getBot();
      const item = bot.inventory.items().find(i => i.name === name);
      if (!item) return factory.err(`Item "${name}" not found`);
      await bot.equip(item, slot);
      return factory.ok(`Equipped ${name} to ${slot}`);
    }
  );

  factory.registerTool(
    "drop_item",
    "Drop items from inventory",
    {
      name: z.string().describe("Item name to drop"),
      count: z.coerce.number().optional().describe("Count to drop (default: all)"),
    },
    async ({ name, count }) => {
      const bot = getBot();
      const item = bot.inventory.items().find(i => i.name === name);
      if (!item) return factory.err(`Item "${name}" not found`);
      if (count && count < item.count) {
        await bot.toss(item.type, null, count);
      } else {
        await bot.tossStack(item);
      }
      return factory.ok(`Dropped ${name}`);
    }
  );
}
