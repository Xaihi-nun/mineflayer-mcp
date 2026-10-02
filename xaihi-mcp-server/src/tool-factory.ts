import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, ZodRawShape, ZodType, ZodError } from "zod";
import { BotConnection } from './bot-connection.js';

export type McpResponse = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export class ToolFactory {
  constructor(private server: McpServer, private connection: BotConnection) {}

  registerTool<T = Record<string, any>>(
    name: string,
    description: string,
    schema: Record<string, unknown>,
    executor: (args: T) => Promise<McpResponse>,
    options: { skipConnectionCheck?: boolean } = {}
  ): void {
    this.server.tool(name, description, schema, async (args: any): Promise<McpResponse> => {
      if (!options.skipConnectionCheck) {
        const check = await this.connection.checkConnection();
        if (!check.ok) {
          return { content: [{ type: "text", text: check.error! }], isError: true };
        }
      }

      try {
        const parsed = this.isZodShape(schema) ? this.parseArgs(schema as ZodRawShape, args) : args;
        return await executor(parsed as T);
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    });
  }

  ok(text: string): McpResponse {
    return { content: [{ type: "text", text }] };
  }

  err(message: string): McpResponse {
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }

  private isZodShape(schema: Record<string, unknown>): boolean {
    const values = Object.values(schema);
    return values.length === 0 || values.every(v => v instanceof ZodType);
  }

  private parseArgs(schema: ZodRawShape, args: any): any {
    try {
      return z.object(schema).passthrough().parse(args ?? {});
    } catch (e) {
      if (e instanceof ZodError) {
        throw new Error(`Invalid arguments: ${e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      }
      throw e;
    }
  }
}
