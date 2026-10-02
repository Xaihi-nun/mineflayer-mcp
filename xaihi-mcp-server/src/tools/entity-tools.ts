import { z } from "zod";
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { ToolFactory } from '../tool-factory.js';

export function registerEntityTools(factory: ToolFactory, getBot: () => mineflayer.Bot): void {
  factory.registerTool(
    "find_players",
    "List online players with their positions",
    {},
    async () => {
      const bot = getBot();
      const players = Object.values(bot.players).map(p => {
        const e = p.entity;
        return e
          ? `${p.username} at (${Math.floor(e.position.x)}, ${Math.floor(e.position.y)}, ${Math.floor(e.position.z)})`
          : p.username;
      });
      if (players.length === 0) return factory.ok("No other players online");
      return factory.ok(`Players: ${players.join(', ')}`);
    }
  );

  factory.registerTool(
    "find_nearby_entities",
    "Find entities (including players) near the bot",
    {
      maxDistance: z.coerce.number().min(1).max(256).optional().describe("Search radius (default: 32)"),
    },
    async ({ maxDistance = 32 }) => {
      const bot = getBot();
      const pos = bot.entity.position;
      const nearby = Object.values(bot.entities)
        .filter(e => e !== bot.entity && e.position.distanceTo(pos) <= maxDistance && (e.type === 'mob' || e.type === 'player'))
        .map(e => `${(e.type === 'player' ? e.username : e.name) || e.type} at (${Math.floor(e.position.x)}, ${Math.floor(e.position.y)}, ${Math.floor(e.position.z)})`)
        .slice(0, 10);
      if (nearby.length === 0) return factory.ok("No entities nearby");
      return factory.ok(nearby.join('\n'));
    }
  );

  factory.registerTool(
    "follow_player",
    "Move toward and stay near a player",
    {
      player: z.string().describe("Username to follow"),
      distance: z.coerce.number().min(1).max(10).optional().describe("Distance to keep (default: 5)"),
    },
    async ({ player, distance = 5 }) => {
      const bot = getBot();
      const target = Object.values(bot.players).find(p => p.username === player);
      if (!target) return factory.err(`Player "${player}" not found`);
      if (!target.entity) return factory.err(`Cannot see "${player}" — they are out of the bot's view range`);
      bot.pathfinder.setGoal(new goals.GoalFollow(target.entity, distance), true);
      return factory.ok(`Following ${player} (keeping ~${distance} blocks distance)`);
    }
  );

  factory.registerTool(
    "attack_entity",
    "Attack a nearby entity",
    {
      name: z.string().describe("Entity name to attack, e.g. 'zombie', 'creeper'"),
    },
    async ({ name }) => {
      const bot = getBot();
      const target = Object.values(bot.entities).find(e => e.name === name && e !== bot.entity && e.position.distanceTo(bot.entity.position) < 6);
      if (!target) return factory.err(`No ${name} nearby`);
      bot.attack(target);
      return factory.ok(`Attacked ${name}`);
    }
  );
}
