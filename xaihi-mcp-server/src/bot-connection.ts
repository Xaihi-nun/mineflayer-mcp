import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { pathfinder, Movements } = pathfinderPkg;

export interface BotConfig {
  host: string;
  port: number;
  username: string;
  mcVersion: string;
}

export interface BotConnectionEvents {
  onLog: (level: 'info' | 'warn' | 'error', message: string) => void;
  onChatMessage: (username: string, message: string) => void;
}

const FATAL_ERROR_CODES = [
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNRESET',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
];

export class BotConnection {
  private bot: mineflayer.Bot | null = null;
  private state: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private config: BotConfig;
  private events: BotConnectionEvents;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 3000;
  private isReconnecting = false;
  // active = a login has been requested and no logout happened since.
  // Gates auto-reconnect; tools refuse to run when false.
  private active = false;

  constructor(config: BotConfig, events: BotConnectionEvents) {
    this.config = config;
    this.events = events;
  }

  getBot(): mineflayer.Bot | null {
    return this.bot;
  }

  getBotOrFail(): mineflayer.Bot {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }
    return this.bot;
  }

  getState(): string {
    return this.state;
  }

  getConfig(): BotConfig {
    return this.config;
  }

  isActive(): boolean {
    return this.active;
  }

  /**
   * Log in to a Minecraft server. Connection parameters can be overridden per call;
   * otherwise the startup config (CLI args / defaults) is used.
   */
  async login(overrides?: Partial<BotConfig>): Promise<{ ok: boolean; error?: string }> {
    if (this.active && this.state === 'connected') {
      return {
        ok: false,
        error: `Already logged in as ${this.config.username} on ${this.config.host}:${this.config.port}. Use logout first.`,
      };
    }

    // Clear any leftover half-open or failed connection before starting fresh
    this.disconnect();

    try {
      this.connect(overrides);
    } catch (err) {
      this.disconnect();
      return { ok: false, error: `Failed to start bot: ${err instanceof Error ? err.message : String(err)}` };
    }

    const timeout = 20000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.state === 'connected') {
        return { ok: true };
      }
      if (this.state === 'disconnected') {
        this.disconnect();
        return { ok: false, error: `Failed to connect to ${this.config.host}:${this.config.port}` };
      }
      await new Promise(r => setTimeout(r, 200));
    }

    this.disconnect();
    return { ok: false, error: `Timed out connecting to ${this.config.host}:${this.config.port}` };
  }

  /** Log out: stop the bot and stop auto-reconnect attempts. */
  disconnect(): void {
    this.active = false;
    this.isReconnecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.bot) {
      try { this.bot.quit('Xaihi is signing off.'); } catch {}
      this.bot = null;
    }
    this.state = 'disconnected';
  }

  private connect(overrides?: Partial<BotConfig>): void {
    if (overrides) {
      this.config = { ...this.config, ...overrides };
    }
    if (this.bot) {
      try { this.bot.quit(); } catch {}
      this.bot = null;
    }

    this.active = true;
    this.state = 'connecting';
    this.bot = mineflayer.createBot({
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      version: this.config.mcVersion,
      plugins: { pathfinder },
    });

    this.setupEventHandlers(this.bot);
  }

  private setupEventHandlers(bot: mineflayer.Bot): void {
    bot.once('spawn', () => {
      if (this.bot !== bot) return;
      this.state = 'connected';
      const move = new Movements(bot as any);
      (bot as any).pathfinder.setMovements(move);
      bot.chat(`${this.config.username} is online and ready.`);
      this.events.onLog('info', `Bot spawned as ${this.config.username} on ${this.config.host}:${this.config.port}`);
    });

    bot.on('chat', (username: string, message: string) => {
      if (this.bot !== bot || username === bot.username) return;
      this.events.onChatMessage(username, message);
    });

    bot.on('error', (err: Error & { code?: string }) => {
      if (this.bot !== bot) return;
      const code = err.code || 'unknown';
      this.events.onLog('error', `Bot error [${code}]: ${err.message}`);
      if (FATAL_ERROR_CODES.includes(code)) {
        this.state = 'disconnected';
      }
    });

    bot.on('kicked', (reason: string) => {
      if (this.bot !== bot) return;
      this.events.onLog('error', `Bot kicked: ${reason}`);
      this.state = 'disconnected';
    });

    bot.on('end', () => {
      if (this.bot !== bot) return;
      this.events.onLog('info', 'Bot disconnected');
      this.state = 'disconnected';
    });
  }

  async checkConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.active) {
      return { ok: false, error: 'Not logged in to a Minecraft server. Use the login tool first.' };
    }
    if (this.state === 'connected') return { ok: true };
    if (this.state === 'connecting') {
      return { ok: false, error: 'Bot is connecting, please wait...' };
    }

    // Logged in before but the connection dropped — try to reconnect
    if (!this.isReconnecting) {
      this.isReconnecting = true;
      this.events.onLog('info', `Reconnecting in ${this.reconnectDelay}ms...`);
      this.reconnectTimer = setTimeout(() => {
        this.connect();
        this.isReconnecting = false;
      }, this.reconnectDelay);
    }

    const timeout = 10000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.getState() === 'connected') return { ok: true };
      await new Promise(r => setTimeout(r, 200));
    }

    return { ok: false, error: `Failed to reconnect to ${this.config.host}:${this.config.port}` };
  }

  cleanup(): void {
    this.disconnect();
  }
}
