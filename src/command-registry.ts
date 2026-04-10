import { getCommandContract } from './command-contracts.js';
import { OrfeError, createNotImplementedError } from './errors.js';
import { handleIssueComment, handleIssueGet, handleIssueSetState, handleIssueUpdate } from './issue.js';
import type { CommandContext, CommandInput, OrfeCommandGroup, OrfeCommandName } from './types.js';

type OptionType = 'string' | 'number' | 'boolean' | 'enum' | 'string-array';

export interface CommandOptionDefinition {
  key: string;
  flag: `--${string}`;
  description: string;
  type: OptionType;
  required?: boolean;
  enumValues?: readonly string[];
}

export interface CommandDefinition {
  name: OrfeCommandName;
  group: OrfeCommandGroup;
  leaf: string;
  purpose: string;
  usage: string;
  successSummary: string;
  examples: string[];
  options: CommandOptionDefinition[];
  successDataExample: Record<string, unknown>;
  handler(context: CommandContext): Promise<unknown>;
  validate?(input: CommandInput): void;
}

const commonCliOptions: CommandOptionDefinition[] = [
  {
    key: 'caller_name',
    flag: '--caller-name',
    description: 'Caller identity for CLI mode.',
    type: 'string',
  },
  {
    key: 'config',
    flag: '--config',
    description: 'Override the repo-local config path.',
    type: 'string',
  },
  {
    key: 'auth_config',
    flag: '--auth-config',
    description: 'Override the machine-local auth config path.',
    type: 'string',
  },
  {
    key: 'repo',
    flag: '--repo',
    description: 'Override the target repository as owner/name.',
    type: 'string',
  },
];

export const COMMAND_DEFINITIONS: readonly CommandDefinition[] = [
  defineCommand({
    name: 'issue.get',
    purpose: 'Read one issue.',
    usage: 'orfe issue get --issue-number <number> [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON issue payload.',
    examples: ['orfe issue get --issue-number 14 --caller-name Greg'],
    options: [{ key: 'issue_number', flag: '--issue-number', description: 'Issue number.', type: 'number', required: true }],
    handler: handleIssueGet,
  }),
  defineCommand({
    name: 'issue.create',
    purpose: 'Create a generic issue.',
    usage: 'orfe issue create --title <text> [--body <text>] [--label <name> ...] [--assignee <login> ...] [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON create result.',
    examples: ['orfe issue create --title "New issue" --caller-name Greg'],
    options: [
      { key: 'title', flag: '--title', description: 'Issue title.', type: 'string', required: true },
      { key: 'body', flag: '--body', description: 'Issue body.', type: 'string' },
      { key: 'labels', flag: '--label', description: 'Issue label.', type: 'string-array' },
      { key: 'assignees', flag: '--assignee', description: 'Issue assignee.', type: 'string-array' },
    ],
  }),
  defineCommand({
    name: 'issue.update',
    purpose: 'Update mutable issue fields without changing state.',
    usage: 'orfe issue update --issue-number <number> [--title <text>] [--body <text>] [--label <name> ...] [--assignee <login> ...] [--clear-labels] [--clear-assignees] [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON update result.',
    examples: ['orfe issue update --issue-number 14 --title "Updated title" --caller-name Greg'],
    options: [
      { key: 'issue_number', flag: '--issue-number', description: 'Issue number.', type: 'number', required: true },
      { key: 'title', flag: '--title', description: 'Updated title.', type: 'string' },
      { key: 'body', flag: '--body', description: 'Updated body.', type: 'string' },
      { key: 'labels', flag: '--label', description: 'Replacement labels.', type: 'string-array' },
      { key: 'assignees', flag: '--assignee', description: 'Replacement assignees.', type: 'string-array' },
      { key: 'clear_labels', flag: '--clear-labels', description: 'Clear all labels.', type: 'boolean' },
      { key: 'clear_assignees', flag: '--clear-assignees', description: 'Clear all assignees.', type: 'boolean' },
    ],
    validate(input) {
      if (
        input.title === undefined &&
        input.body === undefined &&
        input.labels === undefined &&
        input.assignees === undefined &&
        input.clear_labels !== true &&
        input.clear_assignees !== true
      ) {
        throw new OrfeError('invalid_usage', 'issue.update requires at least one mutation option.');
      }

      if (input.labels !== undefined && input.clear_labels === true) {
        throw new OrfeError('invalid_usage', 'issue.update does not allow labels together with --clear-labels.');
      }

      if (input.assignees !== undefined && input.clear_assignees === true) {
        throw new OrfeError('invalid_usage', 'issue.update does not allow assignees together with --clear-assignees.');
      }
    },
    handler: handleIssueUpdate,
  }),
  defineCommand({
    name: 'issue.comment',
    purpose: 'Add a top-level issue comment.',
    usage: 'orfe issue comment --issue-number <number> --body <text> [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON comment result.',
    examples: ['orfe issue comment --issue-number 14 --body "hello" --caller-name Greg'],
    options: [
      { key: 'issue_number', flag: '--issue-number', description: 'Issue number.', type: 'number', required: true },
      { key: 'body', flag: '--body', description: 'Comment body.', type: 'string', required: true },
    ],
    handler: handleIssueComment,
  }),
  defineCommand({
    name: 'issue.set-state',
    purpose: 'Set issue open or closed state.',
    usage: 'orfe issue set-state --issue-number <number> --state <open|closed> [--state-reason <completed|not_planned|duplicate>] [--duplicate-of <issue-number>] [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON state-change result.',
    examples: ['orfe issue set-state --issue-number 14 --state closed --state-reason completed --caller-name Greg'],
    options: [
      { key: 'issue_number', flag: '--issue-number', description: 'Issue number.', type: 'number', required: true },
      { key: 'state', flag: '--state', description: 'Target state.', type: 'enum', enumValues: ['open', 'closed'], required: true },
      {
        key: 'state_reason',
        flag: '--state-reason',
        description: 'Reason for closing.',
        type: 'enum',
        enumValues: ['completed', 'not_planned', 'duplicate'],
      },
      { key: 'duplicate_of', flag: '--duplicate-of', description: 'Canonical duplicate issue number.', type: 'number' },
    ],
    validate(input) {
      if (input.state_reason !== undefined && input.state !== 'closed') {
        throw new OrfeError('invalid_usage', 'issue.set-state only allows state_reason when --state closed is used.');
      }

      if (input.duplicate_of !== undefined && input.state_reason !== 'duplicate') {
        throw new OrfeError('invalid_usage', 'issue.set-state only allows duplicate_of with state_reason=duplicate.');
      }

      if (input.state_reason === 'duplicate' && input.duplicate_of === undefined) {
        throw new OrfeError('invalid_usage', 'issue.set-state requires --duplicate-of when state_reason=duplicate.');
      }

      if (input.duplicate_of !== undefined && input.duplicate_of === input.issue_number) {
        throw new OrfeError('invalid_usage', 'issue.set-state cannot mark an issue as a duplicate of itself.');
      }
    },
    handler: handleIssueSetState,
  }),
  defineCommand({
    name: 'pr.get',
    purpose: 'Read one pull request.',
    usage: 'orfe pr get --pr-number <number> [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON pull request payload.',
    examples: ['orfe pr get --pr-number 9 --caller-name Greg'],
    options: [{ key: 'pr_number', flag: '--pr-number', description: 'Pull request number.', type: 'number', required: true }],
  }),
  defineCommand({
    name: 'pr.get-or-create',
    purpose: 'Reuse or create a pull request for a branch pair.',
    usage: 'orfe pr get-or-create --head <branch> --title <text> [--body <text>] [--base <branch>] [--draft] [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON pull request result.',
    examples: ['orfe pr get-or-create --head issues/orfe-14 --title "Build orfe foundation" --caller-name Greg'],
    options: [
      { key: 'head', flag: '--head', description: 'Head branch.', type: 'string', required: true },
      { key: 'title', flag: '--title', description: 'Pull request title.', type: 'string', required: true },
      { key: 'body', flag: '--body', description: 'Pull request body.', type: 'string' },
      { key: 'base', flag: '--base', description: 'Base branch.', type: 'string' },
      { key: 'draft', flag: '--draft', description: 'Create as draft.', type: 'boolean' },
    ],
  }),
  defineCommand({
    name: 'pr.comment',
    purpose: 'Add a top-level pull request comment.',
    usage: 'orfe pr comment --pr-number <number> --body <text> [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON comment result.',
    examples: ['orfe pr comment --pr-number 9 --body "hello" --caller-name Greg'],
    options: [
      { key: 'pr_number', flag: '--pr-number', description: 'Pull request number.', type: 'number', required: true },
      { key: 'body', flag: '--body', description: 'Comment body.', type: 'string', required: true },
    ],
  }),
  defineCommand({
    name: 'pr.submit-review',
    purpose: 'Submit a completed pull request review.',
    usage: 'orfe pr submit-review --pr-number <number> --event <approve|request-changes|comment> --body <text> [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON review result.',
    examples: ['orfe pr submit-review --pr-number 9 --event approve --body "Looks good" --caller-name Greg'],
    options: [
      { key: 'pr_number', flag: '--pr-number', description: 'Pull request number.', type: 'number', required: true },
      {
        key: 'event',
        flag: '--event',
        description: 'Review event.',
        type: 'enum',
        enumValues: ['approve', 'request-changes', 'comment'],
        required: true,
      },
      { key: 'body', flag: '--body', description: 'Review body.', type: 'string', required: true },
    ],
  }),
  defineCommand({
    name: 'pr.reply',
    purpose: 'Reply to an existing pull request review comment.',
    usage: 'orfe pr reply --pr-number <number> --comment-id <number> --body <text> [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON reply result.',
    examples: ['orfe pr reply --pr-number 9 --comment-id 123 --body "ack" --caller-name Greg'],
    options: [
      { key: 'pr_number', flag: '--pr-number', description: 'Pull request number.', type: 'number', required: true },
      { key: 'comment_id', flag: '--comment-id', description: 'Review comment id.', type: 'number', required: true },
      { key: 'body', flag: '--body', description: 'Reply body.', type: 'string', required: true },
    ],
  }),
  defineCommand({
    name: 'project.get-status',
    purpose: 'Read the current Status field value for a project item.',
    usage: 'orfe project get-status --item-type <issue|pr> --item-number <number> [--project-owner <login>] [--project-number <number>] [--status-field-name <name>] [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON project status payload.',
    examples: ['orfe project get-status --item-type issue --item-number 14 --caller-name Greg'],
    options: [
      { key: 'item_type', flag: '--item-type', description: 'Item type.', type: 'enum', enumValues: ['issue', 'pr'], required: true },
      { key: 'item_number', flag: '--item-number', description: 'Item number.', type: 'number', required: true },
      { key: 'project_owner', flag: '--project-owner', description: 'Project owner.', type: 'string' },
      { key: 'project_number', flag: '--project-number', description: 'Project number.', type: 'number' },
      { key: 'status_field_name', flag: '--status-field-name', description: 'Status field name.', type: 'string' },
    ],
  }),
  defineCommand({
    name: 'project.set-status',
    purpose: 'Set the Status field value for a project item.',
    usage: 'orfe project set-status --item-type <issue|pr> --item-number <number> --status <value> [--project-owner <login>] [--project-number <number>] [--status-field-name <name>] [--repo <owner/name>] [--caller-name <name>] [--config <path>] [--auth-config <path>]',
    successSummary: 'Prints a structured JSON project status mutation result.',
    examples: ['orfe project set-status --item-type issue --item-number 14 --status "In Progress" --caller-name Greg'],
    options: [
      { key: 'item_type', flag: '--item-type', description: 'Item type.', type: 'enum', enumValues: ['issue', 'pr'], required: true },
      { key: 'item_number', flag: '--item-number', description: 'Item number.', type: 'number', required: true },
      { key: 'status', flag: '--status', description: 'Target status value.', type: 'string', required: true },
      { key: 'project_owner', flag: '--project-owner', description: 'Project owner.', type: 'string' },
      { key: 'project_number', flag: '--project-number', description: 'Project number.', type: 'number' },
      { key: 'status_field_name', flag: '--status-field-name', description: 'Status field name.', type: 'string' },
    ],
  }),
] as const;

export function getCommandDefinition(commandName: string): CommandDefinition {
  const commandDefinition = COMMAND_DEFINITIONS.find((candidate) => candidate.name === commandName);
  if (!commandDefinition) {
    throw new OrfeError('invalid_usage', `Unknown command "${commandName}".`);
  }

  return commandDefinition;
}

export function listCommandNames(): OrfeCommandName[] {
  return COMMAND_DEFINITIONS.map((definition) => definition.name);
}

export function getGroupDefinitions(group: OrfeCommandGroup): CommandDefinition[] {
  return COMMAND_DEFINITIONS.filter((definition) => definition.group === group);
}

export function getCliCommonOptions(): readonly CommandOptionDefinition[] {
  return commonCliOptions;
}

export function validateCommandInput(definition: CommandDefinition, input: CommandInput): CommandInput {
  const validatedInput: CommandInput = {};
  const allowedKeys = new Set(['repo', ...definition.options.map((option) => option.key)]);

  for (const inputKey of Object.keys(input)) {
    if (!allowedKeys.has(inputKey)) {
      throw new OrfeError('invalid_usage', `Command "${definition.name}" does not accept input field "${inputKey}".`);
    }
  }

  if (input.repo !== undefined) {
    validatedInput.repo = validateOptionValue({ key: 'repo', type: 'string' }, input.repo);
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

  definition.validate?.(validatedInput);
  return validatedInput;
}

function defineCommand(
  definition: Omit<CommandDefinition, 'group' | 'leaf' | 'handler' | 'successDataExample'> & {
    handler?: CommandDefinition['handler'];
    validate?: CommandDefinition['validate'];
  },
): CommandDefinition {
  const [group, leaf] = definition.name.split('.') as [OrfeCommandGroup, string];
  const contract = getCommandContract(definition.name);

  return {
    ...definition,
    group,
    leaf,
    successDataExample: contract.successDataExample,
    handler:
      definition.handler ??
      (async () => {
        throw createNotImplementedError(definition.name);
      }),
  };
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
        throw new OrfeError(
          'invalid_usage',
          `Option "${option.key}" must be one of: ${(option.enumValues ?? []).join(', ')}.`,
        );
      }
      return value;
  }
}
