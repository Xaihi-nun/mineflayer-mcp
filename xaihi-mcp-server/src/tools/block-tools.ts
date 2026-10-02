import { z } from "zod";
import mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import { ToolFactory } from '../tool-factory.js';

export function registerBlockTools(factory: ToolFactory, getBot: () => mineflayer.Bot): void {
  factory.registerTool(
    "get_block",
    "Get info about a block at a position",
    {
      x: z.coerce.number(),
      y: z.coerce.number(),
      z: z.coerce.number(),
    },
    async ({ x, y, z }) => {
      const bot = getBot();
      const block = bot.blockAt(new Vec3(x, y, z));
      if (!block) return factory.err(`No block at (${x}, ${y}, ${z})`);
      return factory.ok(`Block: ${block.name} (${block.type}) at (${x}, ${y}, ${z})`);
    }
  );

  factory.registerTool(
    "find_blocks",
    "Find blocks of a type near the bot",
    {
      name: z.string().describe("Block name, e.g. 'oak_log', 'diamond_ore'"),
      maxDistance: z.coerce.number().min(1).max(256).optional().describe("Search radius (default: 64)"),
      count: z.coerce.number().min(1).max(100).optional().describe("Max results (default: 10)"),
    },
    async ({ name, maxDistance = 64, count = 10 }) => {
      const bot = getBot();
      if (!(bot as any).registry?.blocksByName?.[name]) return factory.err(`Unknown block name: ${name}`);
      const pos = bot.entity.position;
      const blocks = bot.findBlocks({
        matching: (block: any) => block !== null && block.name === name,
        maxDistance,
        count,
      });
      if (blocks.length === 0) return factory.ok(`No ${name} blocks found within ${maxDistance} blocks`);
      const list = blocks.map(b => `(${Math.floor(b.x)}, ${Math.floor(b.y)}, ${Math.floor(b.z)})`).join(', ');
      return factory.ok(`Found ${blocks.length} ${name}: ${list}`);
    }
  );

  factory.registerTool(
    "break_block",
    "Break a block at a position",
    {
      x: z.coerce.number(),
      y: z.coerce.number(),
      z: z.coerce.number(),
    },
    async ({ x, y, z }) => {
      const bot = getBot();
      const block = bot.blockAt(new Vec3(x, y, z));
      if (!block) return factory.err(`No block at (${x}, ${y}, ${z})`);
      if (!bot.canDigBlock(block)) return factory.err(`Cannot dig ${block.name}`);
      await bot.dig(block);
      return factory.ok(`Broke ${block.name} at (${x}, ${y}, ${z})`);
    }
  );

  factory.registerTool(
    "place_block",
    "Place a block next to an existing block",
    {
      referenceX: z.coerce.number().describe("X of adjacent block"),
      referenceY: z.coerce.number().describe("Y of adjacent block"),
      referenceZ: z.coerce.number().describe("Z of adjacent block"),
      face: z.enum(['up', 'down', 'north', 'south', 'east', 'west']).describe("Which face to place on"),
      itemName: z.string().optional().describe("Item name to hold before placing (e.g. 'white_concrete'); if omitted, uses whatever is in hand"),
    },
    async ({ referenceX, referenceY, referenceZ, face, itemName }) => {
      const bot = getBot();
      const refBlock = bot.blockAt(new Vec3(referenceX, referenceY, referenceZ));
      if (!refBlock) return factory.err(`No block at reference position (${referenceX}, ${referenceY}, ${referenceZ})`);
      if (itemName) {
        const item = bot.inventory.items().find(i => i.name === itemName);
        if (!item) return factory.err(`Item "${itemName}" not found in inventory`);
        await bot.equip(item, 'hand');
      }
      const faces: Record<string, [number, number, number]> = {
        up: [0, 1, 0], down: [0, -1, 0],
        north: [0, 0, -1], south: [0, 0, 1],
        east: [1, 0, 0], west: [-1, 0, 0],
      };
      const [dx, dy, dz] = faces[face];
      const dest = new Vec3(referenceX + dx, referenceY + dy, referenceZ + dz);
      if (bot.blockAt(dest)?.boundingBox !== 'empty') {
        return factory.err(`Destination (${dest.x}, ${dest.y}, ${dest.z}) is not empty (has ${bot.blockAt(dest)?.name})`);
      }
      await bot.placeBlock(refBlock, new Vec3(dx, dy, dz));
      return factory.ok(`Placed ${itemName ?? bot.heldItem?.name ?? 'block'} at (${dest.x}, ${dest.y}, ${dest.z})`);
    }
  );

  factory.registerTool(
    "look_around",
    "Describe what the bot can see nearby",
    {
      radius: z.coerce.number().min(1).max(32).optional().describe("Search radius (default: 8)"),
    },
    async ({ radius = 8 }) => {
      const bot = getBot();
      const pos = bot.entity.position;
      const blocksAround: Record<string, number> = {};
      const entities = bot.entities;

      for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
          for (let z = -radius; z <= radius; z++) {
            const block = bot.blockAt(new Vec3(pos.x + x, pos.y + y, pos.z + z));
            if (block && block.type !== 0) {
              blocksAround[block.name] = (blocksAround[block.name] || 0) + 1;
            }
          }
        }
      }

      const nearbyEntities = Object.values(entities)
        .filter(e => e !== bot.entity && e.position.distanceTo(pos) <= radius && e.type === 'mob')
        .map(e => e.name)
        .slice(0, 5);

      const topBlocks = Object.entries(blocksAround)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => `${name}(${count})`)
        .join(', ');

      let msg = `Nearby blocks (radius ${radius}): ${topBlocks}`;
      if (nearbyEntities.length > 0) {
        msg += `. Nearby entities: ${nearbyEntities.join(', ')}`;
      }
      return factory.ok(msg);
    }
  );
}
