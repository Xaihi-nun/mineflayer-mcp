import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export interface BotConfig {
  host: string;
  port: number;
  username: string;
  mcVersion: string;
}

export function parseConfig(): BotConfig {
  return yargs(hideBin(process.argv))
    .option('host', {
      type: 'string',
      description: 'Minecraft server host',
      default: 'localhost'
    })
    .option('port', {
      type: 'number',
      description: 'Minecraft server port',
      default: 25565
    })
    .option('username', {
      type: 'string',
      description: 'Bot username',
      default: 'Xaihi'
    })
    .option('mc-version', {
      type: 'string',
      description: 'Minecraft version',
      default: '1.21.5'
    })
    .help()
    .alias('help', 'h')
    .parseSync();
}
