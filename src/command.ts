import {
  getCliCommonOptions,
  getCommandDefinition,
  getGroupDefinitions,
  listCommandDefinitions,
  listCommandGroups,
  type CommandDefinition,
  type CommandOptionDefinition,
} from './commands/registry/index.js';
import { CliUsageError, OrfeError, formatCliUsageError } from './errors.js';
import { runOrfeCore, type OrfeCoreDependencies } from './core.js';
import { createErrorResponse } from './response.js';
import type { CommandInput } from './types.js';
import type { OrfeCommandGroup } from './commands/index.js';
import { getOrfeVersion } from './version.js';

export interface ParsedLeafInvocation {
  kind: 'leaf';
  commandDefinition: CommandDefinition;
  callerName: string;
  configPath?: string;
  authConfigPath?: string;
  input: CommandInput;
}

export interface ParsedHelpInvocation {
  kind: 'help';
  output: string;
}

export interface ParsedVersionInvocation {
  kind: 'version';
  output: string;
}

export type ParsedInvocation = ParsedLeafInvocation | ParsedHelpInvocation | ParsedVersionInvocation;

export interface RunCliDependencies extends OrfeCoreDependencies {
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<NodeJS.WriteStream, 'write'>;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
}

export function parseInvocationForCli(args: string[], env: NodeJS.ProcessEnv): ParsedInvocation {
  return parseInvocation(args, env);
}

export async function runCli(args: string[], dependencies: RunCliDependencies = {}): Promise<number> {
  const env = dependencies.env ?? process.env;
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  let parsedInvocation: ParsedLeafInvocation | undefined;

  try {
    const invocation = parseInvocation(args, env);
    if (invocation.kind === 'help' || invocation.kind === 'version') {
      stdout.write(`${invocation.output}\n`);
      return 0;
    }

    parsedInvocation = invocation;
    const result = await runOrfeCore(
      {
        callerName: invocation.callerName,
        command: invocation.commandDefinition.name,
        input: invocation.input,
        entrypoint: 'cli',
        ...(invocation.configPath ? { configPath: invocation.configPath } : {}),
        ...(invocation.authConfigPath ? { authConfigPath: invocation.authConfigPath } : {}),
      },
      dependencies,
    );

    stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError) {
      stderr.write(`${formatCliUsageError(error)}\n`);
      return 2;
    }

    if (parsedInvocation && error instanceof OrfeError && error.code === 'invalid_usage') {
      const cliUsageError = createLeafUsageError(parsedInvocation.commandDefinition, error.message);
      stderr.write(`${formatCliUsageError(cliUsageError)}\n`);
      return 2;
    }

    const commandName = parsedInvocation?.commandDefinition.name ?? 'unknown';
    stderr.write(`${JSON.stringify(createErrorResponse(commandName, error))}\n`);
    return 1;
  }
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

function renderRootHelp(): string {
  const commandGroups = listCommandGroups();
  const rootExamples = listCommandDefinitions()
    .flatMap((definition) => definition.examples)
    .filter((example, index, examples) => example.trim().length > 0 && examples.indexOf(example) === index)
    .slice(0, 2);

  return [
    'orfe - generic GitHub operations runtime',
    '',
    'Usage:',
    `  orfe <${commandGroups.join('|')}> <command> [options]`,
    '  orfe --help',
    '  orfe --version',
    '',
    'Command groups:',
    ...commandGroups.map((group) => `  ${group}`),
    '',
    'Examples:',
    ...(rootExamples.length > 0 ? rootExamples.map((example) => `  ${example}`) : ['  orfe --help']),
    '',
    'Run `orfe <group> --help` for group-specific help.',
  ].join('\n');
}

function renderGroupHelp(group: OrfeCommandGroup): string {
  const groupDefinitions = getGroupDefinitions(group);

  return [
    `orfe ${group}`,
    '',
    'Usage:',
    `  orfe ${group} <command> [options]`,
    '',
    'Commands:',
    ...groupDefinitions.map((definition) => `  ${definition.leaf} - ${definition.purpose}`),
    '',
    'Example:',
    `  ${groupDefinitions[0]?.examples[0] ?? `orfe ${group} --help`}`,
  ].join('\n');
}

function renderLeafHelp(commandDefinition: CommandDefinition): string {
  const requiredOptions = commandDefinition.options.filter((option) => option.required);
  const optionalOptions = dedupeOptionDefinitions([
    ...commandDefinition.options.filter((option) => !option.required),
    ...getCliCommonOptions().filter((option) => !requiredOptions.some((requiredOption) => requiredOption.flag === option.flag)),
  ]);

  return [
    `${commandDefinition.name}`,
    '',
    `Purpose: ${commandDefinition.purpose}`,
    `Usage: ${commandDefinition.usage}`,
    '',
    'Required options:',
    ...(requiredOptions.length > 0 ? requiredOptions.map(formatOptionLine) : ['  (none)']),
    '',
    'Optional options:',
    ...optionalOptions.map(formatOptionLine),
    '',
    `Success: ${commandDefinition.successSummary}`,
    '',
    'Examples:',
    ...commandDefinition.examples.map((example) => `  ${example}`),
    '',
    'JSON success shape example:',
    `  ${JSON.stringify(commandDefinition.successDataExample)}`,
  ].join('\n');
}

function dedupeOptionDefinitions(optionDefinitions: CommandOptionDefinition[]): CommandOptionDefinition[] {
  const seenFlags = new Set<string>();

  return optionDefinitions.filter((optionDefinition) => {
    if (seenFlags.has(optionDefinition.flag)) {
      return false;
    }

    seenFlags.add(optionDefinition.flag);
    return true;
  });
}

function formatOptionLine(optionDefinition: CommandOptionDefinition): string {
  return `  ${optionDefinition.flag} - ${optionDefinition.description}`;
}

function createLeafUsageError(commandDefinition: CommandDefinition, message: string): CliUsageError {
  return new CliUsageError(message, {
    usage: commandDefinition.usage,
    example: commandDefinition.examples[0] ?? commandDefinition.usage,
    see: `orfe ${commandDefinition.group} ${commandDefinition.leaf} --help`,
  });
}
