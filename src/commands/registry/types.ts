import type { CommandContext, CommandInput } from '../../types.js';

export type CommandOptionType = 'string' | 'number' | 'boolean' | 'enum' | 'string-array';

export type CommandGroupFromName<TName extends string> = TName extends `${infer TGroup} ${string}` ? TGroup : never;
export type CommandLeafFromName<TName extends string> = TName extends `${string} ${infer TLeaf}` ? TLeaf : never;

export interface CommandOptionDefinition {
  key: string;
  flag: `--${string}`;
  description: string;
  type: CommandOptionType;
  required?: boolean;
  enumValues?: readonly string[];
}

export interface CommandDefinition<
  TName extends string = string,
  TInput extends CommandInput = CommandInput,
  TData extends object = object,
> {
  name: TName;
  group: CommandGroupFromName<TName>;
  leaf: CommandLeafFromName<TName>;
  purpose: string;
  usage: string;
  successSummary: string;
  examples: readonly string[];
  options: readonly CommandOptionDefinition[];
  validInputExample: TInput;
  successDataExample: TData;
  validate?(input: CommandInput): TInput;
  handler(context: CommandContext<TName, TInput>): Promise<TData>;
}

export type CommandDefinitionInput<
  TName extends string = string,
  TInput extends CommandInput = CommandInput,
  TData extends object = object,
> = Omit<CommandDefinition<TName, TInput, TData>, 'group' | 'leaf'>;
