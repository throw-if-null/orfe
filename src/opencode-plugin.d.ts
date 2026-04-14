declare module '@opencode-ai/plugin' {
  export interface ToolExecutionContext {
    agent?: unknown;
    directory?: string;
  }

  export interface ToolDefinition<TArgs = Record<string, unknown>> {
    description: string;
    args: Record<string, unknown>;
    execute(args: TArgs, context: ToolExecutionContext): Promise<string> | string;
  }

  interface SchemaBuilder {
    min(value: number): this;
    int(): this;
    positive(): this;
    optional(): this;
  }

  export const tool: {
    <TArgs = Record<string, unknown>>(definition: ToolDefinition<TArgs>): ToolDefinition<TArgs>;
    schema: {
      string(): SchemaBuilder;
      number(): SchemaBuilder;
      boolean(): SchemaBuilder;
      array(schema: unknown): SchemaBuilder;
      enum(values: readonly string[]): SchemaBuilder;
    };
  };
}
