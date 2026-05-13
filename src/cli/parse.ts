import {
  getCliCommonOptions,
  getCommandDefinition,
  getTopLevelCommandDefinition,
  listCommandGroups,
  type CommandDefinition,
  type CommandOptionDefinition,
} from '../commands/registry/index.js';
import { getOrfeVersion } from '../version.js';

import { renderGroupHelp, renderLeafHelp, renderRootHelp } from './help.js';
import { CliUsageError } from './usage-error.js';
import type { OrfeCommandGroup, ParsedInvocation } from './types.js';
import type { CommandInput } from '../core/types.js';

export function parseInvocationForCli(args: string[], env: NodeJS.ProcessEnv): ParsedInvocation {
  return parseInvocation(args, env);
}

export function createLeafUsageError(commandDefinition: CommandDefinition, message: string): CliUsageError {
  const see = commandDefinition.topLevel
    ? `orfe ${commandDefinition.name} --help`
    : `orfe ${commandDefinition.group} ${commandDefinition.leaf} --help`;

  return new CliUsageError(message, {
    usage: commandDefinition.usage,
    example: commandDefinition.examples[0] ?? commandDefinition.usage,
    see,
  });
}

function parseInvocation(args: string[], env: NodeJS.ProcessEnv): ParsedInvocation {
  const commandGroups = listCommandGroups();

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return {
      kind: 'help',
      output: renderRootHelp(),
    };
  }

  if (args[0] === '--version') {
    return {
      kind: 'version',
      output: getOrfeVersion(),
    };
  }

  const topLevelCommandDefinition = args[0] ? getTopLevelCommandDefinition(args[0]) : undefined;
  if (topLevelCommandDefinition) {
    const rest = args.slice(1);

    if (rest.includes('--help') || rest.includes('-h')) {
      return {
        kind: 'help',
        output: renderLeafHelp(topLevelCommandDefinition),
      };
    }

    const { input, callerName, configPath, authConfigPath } = parseLeafOptions(topLevelCommandDefinition, rest, env);

    return {
      kind: 'leaf',
      commandDefinition: topLevelCommandDefinition,
      callerName,
      ...(configPath ? { configPath } : {}),
      ...(authConfigPath ? { authConfigPath } : {}),
      input,
    };
  }

  const [group, maybeLeaf, ...rest] = args;
  if (!group || !isCommandGroup(group)) {
    throw new CliUsageError(`Unknown command group "${group}".`, {
      usage: `orfe <${commandGroups.join('|')}> <command> [options]`,
      example: getCommandDefinition('auth token').examples[0] ?? 'ORFE_CALLER_NAME=Greg orfe auth token --repo throw-if-null/orfe',
      see: 'orfe --help',
    });
  }

  if (!maybeLeaf || maybeLeaf === '--help' || maybeLeaf === '-h') {
    return {
      kind: 'help',
      output: renderGroupHelp(group),
    };
  }

  const commandName = `${group} ${maybeLeaf}`;
  const commandDefinition = getCommandDefinitionForCli(commandName, group, maybeLeaf);

  if (rest.includes('--help') || rest.includes('-h')) {
    return {
      kind: 'help',
      output: renderLeafHelp(commandDefinition),
    };
  }

  const { input, callerName, configPath, authConfigPath } = parseLeafOptions(commandDefinition, rest, env);

  return {
    kind: 'leaf',
    commandDefinition,
    callerName,
    ...(configPath ? { configPath } : {}),
    ...(authConfigPath ? { authConfigPath } : {}),
    input,
  };
}

function parseLeafOptions(
  commandDefinition: CommandDefinition,
  args: string[],
  env: NodeJS.ProcessEnv,
): {
  input: CommandInput;
  callerName: string;
  configPath?: string;
  authConfigPath?: string;
} {
  const allOptions = [...commandDefinition.options, ...getCliCommonOptions()];
  const byFlag = new Map(allOptions.map((option) => [option.flag, option]));
  const input: CommandInput = {};
  const callerName = env.ORFE_CALLER_NAME ?? '';
  const requiresCaller = commandDefinition.requiresCaller ?? true;
  let configPath: string | undefined;
  let authConfigPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token?.startsWith('--')) {
      throw createLeafUsageError(commandDefinition, `Unexpected argument "${token}".`);
    }

    const optionDefinition = byFlag.get(token as `--${string}`);
    if (!optionDefinition) {
      throw createLeafUsageError(commandDefinition, `Unknown option "${token}".`);
    }

    const value = parseCliOptionValue(commandDefinition, optionDefinition, args[index + 1]);
    if (optionDefinition.type !== 'boolean') {
      index += 1;
    }

    switch (optionDefinition.key) {
      case 'config':
        configPath = value as string;
        break;
      case 'auth_config':
        authConfigPath = value as string;
        break;
      default:
        if (optionDefinition.type === 'string-array') {
          const existingValues = (input[optionDefinition.key] as string[] | undefined) ?? [];
          existingValues.push(value as string);
          input[optionDefinition.key] = existingValues;
        } else {
          input[optionDefinition.key] = value;
        }
        break;
    }
  }

  if (requiresCaller && callerName.trim().length === 0) {
    throw createLeafUsageError(commandDefinition, 'CLI caller identity is required via ORFE_CALLER_NAME.');
  }

  for (const optionDefinition of commandDefinition.options) {
    if (optionDefinition.required && input[optionDefinition.key] === undefined) {
      throw createLeafUsageError(commandDefinition, `Missing required option "${optionDefinition.flag}".`);
    }
  }

  return {
    input,
    callerName,
    ...(configPath ? { configPath } : {}),
    ...(authConfigPath ? { authConfigPath } : {}),
  };
}

function parseCliOptionValue(
  commandDefinition: CommandDefinition,
  optionDefinition: CommandOptionDefinition,
  nextToken: string | undefined,
): string | number | boolean {
  if (optionDefinition.type === 'boolean') {
    return true;
  }

  if (!nextToken || nextToken.startsWith('--')) {
    throw createLeafUsageError(commandDefinition, `Missing value for option "${optionDefinition.flag}".`);
  }

  switch (optionDefinition.type) {
    case 'string':
    case 'string-array':
      return nextToken;
    case 'number': {
      const parsedNumber = Number(nextToken);
      if (!Number.isInteger(parsedNumber)) {
        throw createLeafUsageError(commandDefinition, `Option "${optionDefinition.flag}" expects an integer.`);
      }
      return parsedNumber;
    }
    case 'enum':
      if (!optionDefinition.enumValues?.includes(nextToken)) {
        throw createLeafUsageError(
          commandDefinition,
          `Option "${optionDefinition.flag}" must be one of: ${(optionDefinition.enumValues ?? []).join(', ')}.`,
        );
      }
      return nextToken;
    default:
      throw createLeafUsageError(commandDefinition, `Option "${optionDefinition.flag}" has an unsupported type.`);
  }
}

function isCommandGroup(value: string): value is OrfeCommandGroup {
  return listCommandGroups().includes(value as OrfeCommandGroup);
}

function getCommandDefinitionForCli(commandName: string, group: OrfeCommandGroup, leaf: string): CommandDefinition {
  try {
    return getCommandDefinition(commandName);
  } catch {
    throw new CliUsageError(`Unknown command "${group} ${leaf}".`, {
      usage: `orfe ${group} <command> [options]`,
      example: `orfe ${group} --help`,
      see: `orfe ${group} --help`,
    });
  }
}
