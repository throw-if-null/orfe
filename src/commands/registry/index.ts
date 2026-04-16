import { OrfeError } from '../../errors.js';
import { COMMANDS, type OrfeCommandGroup, type OrfeCommandName } from '../index.js';
import { COMMON_CLI_OPTIONS } from './common-options.js';
import type { CommandDefinition, CommandOptionDefinition } from './types.js';
import type { CommandInput } from '../../types.js';

const COMMAND_DEFINITION_MAP = createCommandDefinitionMap(COMMANDS);
const COMMAND_GROUPS = createCommandGroupList(COMMANDS);

export function listCommandDefinitions(): readonly CommandDefinition[] {
  return COMMANDS;
}

export function listCommandNames(): OrfeCommandName[] {
  return COMMANDS.map((definition) => definition.name);
}

export function listCommandGroups(): OrfeCommandGroup[] {
  return [...COMMAND_GROUPS];
}

export function getCommandDefinition<TName extends OrfeCommandName | string>(commandName: TName): CommandDefinition {
  const commandDefinition = COMMAND_DEFINITION_MAP.get(commandName);
  if (!commandDefinition) {
    throw new OrfeError('invalid_usage', `Unknown command "${commandName}".`);
  }

  return commandDefinition;
}

export function getGroupDefinitions(group: OrfeCommandGroup): CommandDefinition[] {
  return COMMANDS.filter((definition) => definition.group === group);
}

export function getCliCommonOptions(): readonly CommandOptionDefinition[] {
  return COMMON_CLI_OPTIONS;
}

export function validateCommandInput<TInput extends CommandInput>(definition: CommandDefinition<string, TInput>, input: CommandInput): TInput {
  const validatedInput: CommandInput = {};
  const allowedKeys = new Set(definition.options.map((option) => option.key));

  for (const inputKey of Object.keys(input)) {
    if (!allowedKeys.has(inputKey)) {
      throw new OrfeError('invalid_usage', `Command "${definition.name}" does not accept input field "${inputKey}".`);
    }
  }

  for (const option of definition.options) {
    const rawValue = input[option.key];

    if (rawValue === undefined) {
      if (option.required) {
        throw new OrfeError('invalid_usage', `Command "${definition.name}" requires input field "${option.key}".`);
      }

      continue;
    }

    validatedInput[option.key] = validateOptionValue(option, rawValue);
  }

  return definition.validate ? definition.validate(validatedInput) : (validatedInput as TInput);
}

function createCommandDefinitionMap(commandDefinitions: readonly CommandDefinition[]): ReadonlyMap<string, CommandDefinition> {
  const byName = new Map<string, CommandDefinition>();

  for (const definition of commandDefinitions) {
    if (byName.has(definition.name)) {
      throw new Error(`Duplicate command registration for "${definition.name}".`);
    }

    byName.set(definition.name, definition);
  }

  return byName;
}

function createCommandGroupList(commandDefinitions: readonly CommandDefinition[]): OrfeCommandGroup[] {
  const seen = new Set<string>();
  const groups: OrfeCommandGroup[] = [];

  for (const definition of commandDefinitions) {
    if (seen.has(definition.group)) {
      continue;
    }

    seen.add(definition.group);
    groups.push(definition.group as OrfeCommandGroup);
  }

  return groups;
}

function validateOptionValue(option: Pick<CommandOptionDefinition, 'key' | 'type' | 'enumValues'>, value: unknown): unknown {
  switch (option.type) {
    case 'string':
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new OrfeError('invalid_usage', `Option "${option.key}" must be a non-empty string.`);
      }
      return value;
    case 'number':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new OrfeError('invalid_usage', `Option "${option.key}" must be an integer.`);
      }
      return value;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new OrfeError('invalid_usage', `Option "${option.key}" must be a boolean.`);
      }
      return value;
    case 'string-array':
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
        throw new OrfeError('invalid_usage', `Option "${option.key}" must be an array of non-empty strings.`);
      }
      return value;
    case 'enum':
      if (typeof value !== 'string' || !option.enumValues?.includes(value)) {
        throw new OrfeError('invalid_usage', `Option "${option.key}" must be one of: ${(option.enumValues ?? []).join(', ')}.`);
      }
      return value;
  }
}
