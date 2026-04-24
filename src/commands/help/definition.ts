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
  supported_input_fields: HelpOptionData[];
  required_input_fields: string[];
  optional_input_fields: string[];
  next_step: {
    tool_input: Record<string, unknown>;
    purpose: string;
  };
  requirements: HelpRequirementsData;
  caller_context_required: boolean;
  top_level: boolean;
}

export interface HelpRequirementsData {
  caller_context: 'required' | 'not_required';
  repo_local_config: 'required' | 'not_required';
  machine_local_auth_config: 'required' | 'not_required';
  github_access: 'required' | 'not_required';
}

export interface HelpRootData {
  scope: 'root';
  canonical_command_name: 'help';
  purpose: string;
  discovery_flow: string[];
  usage: {
    cli: string;
    tool_input: Record<string, unknown>;
    targeted_tool_input: Record<string, unknown>;
  };
  caller_context_required: false;
  requirements: HelpRequirementsData;
  top_level_help: {
    summary: string;
    next_step: {
      tool_input: Record<string, unknown>;
      purpose: string;
    };
  };
  top_level_commands: HelpCommandSummaryData[];
  command_groups: Array<{
    name: string;
    purpose: string;
    commands: HelpCommandSummaryData[];
  }>;
  examples: HelpExampleData[];
}

export interface HelpCommandData {
  scope: 'command';
  canonical_command_name: string;
  purpose: string;
  summary: string;
  usage: {
    cli: string;
    tool_input: Record<string, unknown>;
  };
  supported_input_fields: HelpOptionData[];
  required_options: HelpOptionData[];
  optional_options: HelpOptionData[];
  requirements: HelpRequirementsData;
  examples: HelpExampleData[];
  success_output_summary: string;
  success_data_example: object;
  caller_context_required: boolean;
}

function createIssueGetSuccessDataExample() {
  return {
    issue_number: 13,
    title: 'Design the `orfe` custom tool and CLI contract',
    body: '...',
    state: 'open',
    state_reason: null,
    labels: ['needs-input'],
    assignees: ['greg'],
    html_url: 'https://github.com/throw-if-null/orfe/issues/13',
  };
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
      summary: 'Read one issue. Required input fields: issue_number.',
      usage: {
        cli: 'orfe issue get --issue-number <number> [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
        tool_input: {
          command: 'issue get',
          issue_number: 13,
        },
      },
      supported_input_fields: [
        {
          input_key: 'issue_number',
          cli_flag: '--issue-number',
          description: 'Issue number.',
          type: 'number',
          required: true,
        },
        {
          input_key: 'repo',
          cli_flag: '--repo',
          description: 'Override the target repository as owner/name.',
          type: 'string',
          required: false,
        },
        {
          input_key: 'config',
          cli_flag: '--config',
          description: 'Override the repo-local config path.',
          type: 'string',
          required: false,
        },
        {
          input_key: 'auth_config',
          cli_flag: '--auth-config',
          description: 'Override the machine-local auth config path.',
          type: 'string',
          required: false,
        },
      ],
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
        {
          input_key: 'config',
          cli_flag: '--config',
          description: 'Override the repo-local config path.',
          type: 'string',
          required: false,
        },
        {
          input_key: 'auth_config',
          cli_flag: '--auth-config',
          description: 'Override the machine-local auth config path.',
          type: 'string',
          required: false,
        },
      ],
      requirements: {
        caller_context: 'required',
        repo_local_config: 'required',
        machine_local_auth_config: 'required',
        github_access: 'required',
      },
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
      success_data_example: createIssueGetSuccessDataExample(),
      caller_context_required: true,
    },
    requiresCaller: false,
    requiresRepoConfig: false,
    requiresAuthConfig: false,
    requiresGitHubAccess: false,
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
    discovery_flow: [
      'Start with { "command": "help" } to inspect the public command surface.',
      'Choose a command from top_level_commands or command_groups.',
      'Request targeted help with { "command": "help", "command_name": "<canonical command name>" } before executing the command.',
    ],
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
    requirements: buildRequirements({
      requiresCaller: false,
      requiresRepoConfig: false,
      requiresAuthConfig: false,
      requiresGitHubAccess: false,
    }),
    top_level_help: {
      summary: 'Use help as the primary agent discovery path. Start here, then request targeted help for the command you want to run next.',
      next_step: {
        tool_input: {
          command: 'help',
          command_name: 'issue get',
        },
        purpose: 'Inspect one canonical command in detail before executing it.',
      },
    },
    top_level_commands: topLevelCommands,
    command_groups: Array.from(groupMap.entries()).map(([name, commands]) => ({
      name,
      purpose: describeGroup(name),
      commands,
    })),
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
  const supportedInputFields = [...requiredOptions, ...optionalOptions];

  return {
    scope: 'command',
    canonical_command_name: commandDefinition.name,
    purpose: commandDefinition.purpose,
    summary: buildCommandSummary(commandDefinition),
    usage: {
      cli: commandDefinition.usage,
      tool_input: createToolInputExample(commandDefinition),
    },
    supported_input_fields: supportedInputFields,
    required_options: requiredOptions,
    optional_options: optionalOptions,
    requirements: buildRequirements(commandDefinition),
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
  const requiredOptions = commandDefinition.options.filter((option) => option.required).map(toOptionData);
  const optionalOptions = dedupeOptions([
    ...commandDefinition.options.filter((option) => !option.required),
    ...COMMON_CLI_OPTIONS,
  ]).map(toOptionData);
  const supportedInputFields = [...requiredOptions, ...optionalOptions];

  return {
    canonical_command_name: commandDefinition.name,
    purpose: commandDefinition.purpose,
    usage: {
      cli: commandDefinition.usage,
      tool_input: createToolInputExample(commandDefinition),
    },
    supported_input_fields: supportedInputFields,
    required_input_fields: requiredOptions.map((option) => option.input_key),
    optional_input_fields: optionalOptions.map((option) => option.input_key),
    next_step: {
      tool_input: {
        command: 'help',
        command_name: commandDefinition.name,
      },
      purpose: `Retrieve detailed help for ${commandDefinition.name}.`,
    },
    requirements: buildRequirements(commandDefinition),
    caller_context_required: commandDefinition.requiresCaller ?? true,
    top_level: commandDefinition.topLevel ?? false,
  };
}

export function createHelpRootSuccessData(commandDefinitions: readonly CommandDefinition[]): HelpRootData {
  return buildRootHelpData(commandDefinitions);
}

export function createHelpCommandSuccessData(
  commandDefinitions: readonly CommandDefinition[],
  commandName: string,
): HelpCommandData {
  const commandDefinition = commandDefinitions.find((definition) => definition.name === commandName);
  if (!commandDefinition) {
    throw new OrfeError('invalid_usage', `Unknown command "${commandName}".`);
  }

  return buildCommandHelpData(commandDefinition);
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

function buildRequirements(
  commandDefinition: Pick<CommandDefinition, 'requiresCaller' | 'requiresRepoConfig' | 'requiresAuthConfig' | 'requiresGitHubAccess'>,
): HelpRequirementsData {
  const requiresCaller = commandDefinition.requiresCaller ?? true;
  const requiresRepoConfig = commandDefinition.requiresRepoConfig ?? true;
  const requiresAuthConfig = commandDefinition.requiresAuthConfig ?? true;
  const requiresGitHubAccess = commandDefinition.requiresGitHubAccess ?? true;

  return {
    caller_context: requiresCaller ? 'required' : 'not_required',
    repo_local_config: requiresRepoConfig ? 'required' : 'not_required',
    machine_local_auth_config: requiresAuthConfig ? 'required' : 'not_required',
    github_access: requiresGitHubAccess ? 'required' : 'not_required',
  };
}

function describeGroup(groupName: string): string {
  switch (groupName) {
    case 'auth':
      return 'Authentication and token minting commands.';
    case 'issue':
      return 'GitHub issue read, write, validation, comment, and state commands.';
    case 'pr':
      return 'GitHub pull request read, write, validation, comment, reply, and review commands.';
    case 'project':
      return 'GitHub Project status read and write commands.';
    case 'runtime':
      return 'Runtime inspection commands that do not call GitHub.';
    default:
      return 'Command group.';
  }
}

function buildCommandSummary(commandDefinition: CommandDefinition): string {
  const requiredInputKeys = commandDefinition.options.filter((option) => option.required).map((option) => option.key);
  if (requiredInputKeys.length === 0) {
    return `${commandDefinition.purpose} This command does not require command-specific input fields.`;
  }

  return `${commandDefinition.purpose} Required input fields: ${requiredInputKeys.join(', ')}.`;
}
