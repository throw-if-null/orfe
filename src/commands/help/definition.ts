import { COMMON_CLI_OPTIONS } from '../registry/common-options.js';
import { createCommandDefinition } from '../registry/definition.js';
import type { CommandDefinition, CommandOptionDefinition } from '../registry/types.js';
import { OrfeError } from '../../errors.js';

export interface HelpOptionData {
  input_key: string;
  cli_flag: string;
  description: string;
  type: CommandOptionDefinition['type'];
  required: boolean;
  enum_values?: readonly string[];
}

export interface HelpExampleData {
  cli?: string;
  tool_input?: Record<string, unknown>;
}

export interface HelpCommandSummaryData {
  canonical_command_name: string;
  purpose: string;
  usage: {
    cli: string;
    tool_input: Record<string, unknown>;
  };
  caller_context_required: boolean;
  top_level: boolean;
}

export interface HelpRootData {
  scope: 'root';
  canonical_command_name: 'help';
  purpose: string;
  usage: {
    cli: string;
    tool_input: Record<string, unknown>;
    targeted_tool_input: Record<string, unknown>;
  };
  caller_context_required: false;
  top_level_commands: HelpCommandSummaryData[];
  command_groups: Array<{
    name: string;
    commands: HelpCommandSummaryData[];
  }>;
  examples: HelpExampleData[];
}

export interface HelpCommandData {
  scope: 'command';
  canonical_command_name: string;
  purpose: string;
  usage: {
    cli: string;
    tool_input: Record<string, unknown>;
  };
  required_options: HelpOptionData[];
  optional_options: HelpOptionData[];
  examples: HelpExampleData[];
  success_output_summary: string;
  success_data_example: object;
  caller_context_required: boolean;
}

export interface HelpInput extends Record<string, unknown> {
  command_name?: string;
}

export type HelpData = HelpRootData | HelpCommandData;

export function createHelpCommand(getCommandDefinitions: () => readonly CommandDefinition[]) {
  return createCommandDefinition<'help', HelpInput, HelpData>({
    name: 'help',
    execution: 'runtime',
    topLevel: true,
    purpose: 'Discover available commands and command-specific usage through structured output.',
    usage: 'orfe help [--command-name <command>]',
    successSummary: 'Prints structured JSON describing the orfe command surface or a specific command.',
    examples: ['orfe help', 'orfe help --command-name "issue get"'],
    options: [
      {
        key: 'command_name',
        flag: '--command-name',
        description: 'Return detailed help for one canonical command name.',
        type: 'string',
      },
    ],
    validInputExample: { command_name: 'issue get' },
    successDataExample: {
      scope: 'command' as const,
      canonical_command_name: 'issue get',
      purpose: 'Read one issue.',
      usage: {
        cli: 'orfe issue get --issue-number <number> [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
        tool_input: {
          command: 'issue get',
          issue_number: 13,
        },
      },
      required_options: [
        {
          input_key: 'issue_number',
          cli_flag: '--issue-number',
          description: 'Issue number.',
          type: 'number',
          required: true,
        },
      ],
      optional_options: [
        {
          input_key: 'repo',
          cli_flag: '--repo',
          description: 'Override the target repository as owner/name.',
          type: 'string',
          required: false,
        },
      ],
      examples: [
        {
          cli: 'ORFE_CALLER_NAME=Greg orfe issue get --issue-number 14',
        },
        {
          tool_input: {
            command: 'issue get',
            issue_number: 13,
          },
        },
      ],
      success_output_summary: 'Prints a structured JSON issue payload.',
      success_data_example: {
        issue_number: 13,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: '...',
        state: 'open',
        state_reason: null,
        labels: ['needs-input'],
        assignees: ['greg'],
        html_url: 'https://github.com/throw-if-null/orfe/issues/13',
      },
      caller_context_required: true,
    },
    requiresCaller: false,
    runtimeHandler: ({ input }) => buildHelpData(input, getCommandDefinitions()),
  });
}

function buildHelpData(input: HelpInput, commandDefinitions: readonly CommandDefinition[]): HelpData {
  const commandName = input.command_name?.trim();

  if (!commandName) {
    return buildRootHelpData(commandDefinitions);
  }

  const commandDefinition = commandDefinitions.find((definition) => definition.name === commandName);
  if (!commandDefinition) {
    throw new OrfeError('invalid_usage', `Unknown command "${commandName}".`);
  }

  return buildCommandHelpData(commandDefinition);
}

function buildRootHelpData(commandDefinitions: readonly CommandDefinition[]): HelpRootData {
  const topLevelCommands = commandDefinitions
    .filter((definition) => definition.topLevel && definition.name !== 'help')
    .map(toCommandSummary);
  const groupMap = new Map<string, HelpCommandSummaryData[]>();

  for (const definition of commandDefinitions) {
    if (definition.topLevel) {
      continue;
    }

    const summaries = groupMap.get(definition.group) ?? [];
    summaries.push(toCommandSummary(definition));
    groupMap.set(definition.group, summaries);
  }

  return {
    scope: 'root',
    canonical_command_name: 'help',
    purpose: 'Discover available orfe commands and how to request targeted command help.',
    usage: {
      cli: 'orfe help [--command-name <command>]',
      tool_input: {
        command: 'help',
      },
      targeted_tool_input: {
        command: 'help',
        command_name: 'issue get',
      },
    },
    caller_context_required: false,
    top_level_commands: topLevelCommands,
    command_groups: Array.from(groupMap.entries()).map(([name, commands]) => ({ name, commands })),
    examples: [
      {
        cli: 'orfe help',
        tool_input: { command: 'help' },
      },
      {
        cli: 'orfe help --command-name "issue get"',
        tool_input: { command: 'help', command_name: 'issue get' },
      },
    ],
  };
}

function buildCommandHelpData(commandDefinition: CommandDefinition): HelpCommandData {
  const requiredOptions = commandDefinition.options.filter((option) => option.required).map(toOptionData);
  const optionalOptions = dedupeOptions([
    ...commandDefinition.options.filter((option) => !option.required),
    ...COMMON_CLI_OPTIONS,
  ]).map(toOptionData);

  return {
    scope: 'command',
    canonical_command_name: commandDefinition.name,
    purpose: commandDefinition.purpose,
    usage: {
      cli: commandDefinition.usage,
      tool_input: createToolInputExample(commandDefinition),
    },
    required_options: requiredOptions,
    optional_options: optionalOptions,
    examples: [
      ...commandDefinition.examples.map((example) => ({ cli: example })),
      {
        tool_input: createToolInputExample(commandDefinition),
      },
    ],
    success_output_summary: commandDefinition.successSummary,
    success_data_example: commandDefinition.successDataExample,
    caller_context_required: commandDefinition.requiresCaller ?? true,
  };
}

function toCommandSummary(commandDefinition: CommandDefinition): HelpCommandSummaryData {
  return {
    canonical_command_name: commandDefinition.name,
    purpose: commandDefinition.purpose,
    usage: {
      cli: commandDefinition.usage,
      tool_input: createToolInputExample(commandDefinition),
    },
    caller_context_required: commandDefinition.requiresCaller ?? true,
    top_level: commandDefinition.topLevel ?? false,
  };
}

function createToolInputExample(commandDefinition: CommandDefinition): Record<string, unknown> {
  return {
    command: commandDefinition.name,
    ...commandDefinition.validInputExample,
  };
}

function toOptionData(optionDefinition: CommandOptionDefinition): HelpOptionData {
  return {
    input_key: optionDefinition.key,
    cli_flag: optionDefinition.flag,
    description: optionDefinition.description,
    type: optionDefinition.type,
    required: optionDefinition.required ?? false,
    ...(optionDefinition.enumValues ? { enum_values: optionDefinition.enumValues } : {}),
  };
}

function dedupeOptions(optionDefinitions: readonly CommandOptionDefinition[]): CommandOptionDefinition[] {
  const seen = new Set<string>();

  return optionDefinitions.filter((optionDefinition) => {
    if (seen.has(optionDefinition.flag)) {
      return false;
    }

    seen.add(optionDefinition.flag);
    return true;
  });
}
