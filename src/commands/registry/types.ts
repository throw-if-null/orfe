import type { CommandContext, CommandInput } from '../../types.js';
import type { RuntimeEntrypoint } from '../../version.js';

export type CommandOptionType = 'string' | 'number' | 'boolean' | 'enum' | 'string-array';

export type CommandGroupFromName<TName extends string> = TName extends `${infer TGroup} ${string}` ? TGroup : TName;
export type CommandLeafFromName<TName extends string> = TName extends `${string} ${infer TLeaf}` ? TLeaf : TName;

export interface CommandOptionDefinition {
  key: string;
  flag: `--${string}`;
  description: string;
  type: CommandOptionType;
  required?: boolean;
  enumValues?: readonly string[];
}

export interface RuntimeCommandContext<TName extends string = string, TInput extends CommandInput = CommandInput> {
  command: TName;
  input: TInput;
  entrypoint: RuntimeEntrypoint;
}

interface CommandDefinitionBase<
  TName extends string = string,
  TInput extends CommandInput = CommandInput,
  TData extends object = object,
> {
  name: TName;
  group: CommandGroupFromName<TName>;
  leaf: CommandLeafFromName<TName>;
  topLevel?: boolean;
  purpose: string;
  usage: string;
  successSummary: string;
  examples: readonly string[];
  options: readonly CommandOptionDefinition[];
  validInputExample: TInput;
  successDataExample: TData;
  requiresCaller?: boolean;
  validate?(input: CommandInput): TInput;
}

export interface CoreCommandDefinition<
  TName extends string = string,
  TInput extends CommandInput = CommandInput,
  TData extends object = object,
> extends CommandDefinitionBase<TName, TInput, TData> {
  execution: 'github';
  handler(context: CommandContext<TName, TInput>): Promise<TData>;
  runtimeHandler?: never;
}

export interface RuntimeOnlyCommandDefinition<
  TName extends string = string,
  TInput extends CommandInput = CommandInput,
  TData extends object = object,
> extends CommandDefinitionBase<TName, TInput, TData> {
  execution: 'runtime';
  handler?: never;
  runtimeHandler(context: RuntimeCommandContext<TName, TInput>): Promise<TData> | TData;
}

export type CommandDefinition<
  TName extends string = string,
  TInput extends CommandInput = CommandInput,
  TData extends object = object,
> = CoreCommandDefinition<TName, TInput, TData> | RuntimeOnlyCommandDefinition<TName, TInput, TData>;

export type CoreCommandDefinitionInput<
  TName extends string = string,
  TInput extends CommandInput = CommandInput,
  TData extends object = object,
> = Omit<CoreCommandDefinition<TName, TInput, TData>, 'group' | 'leaf' | 'execution'> & {
  execution?: 'github';
};

export type RuntimeOnlyCommandDefinitionInput<
  TName extends string = string,
  TInput extends CommandInput = CommandInput,
  TData extends object = object,
> = Omit<RuntimeOnlyCommandDefinition<TName, TInput, TData>, 'group' | 'leaf'>;

export type CommandDefinitionInput<
  TName extends string = string,
  TInput extends CommandInput = CommandInput,
  TData extends object = object,
> = CoreCommandDefinitionInput<TName, TInput, TData> | RuntimeOnlyCommandDefinitionInput<TName, TInput, TData>;
