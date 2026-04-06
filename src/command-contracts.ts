import type { CommandInput, OrfeCommandName } from './types.js';

export interface CommandContract {
  validInput: CommandInput;
  successDataExample: Record<string, unknown>;
}

export const COMMAND_NAMES = [
  'issue.get',
  'issue.create',
  'issue.update',
  'issue.comment',
  'issue.set-state',
  'pr.get',
  'pr.get-or-create',
  'pr.comment',
  'pr.submit-review',
  'pr.reply',
  'project.get-status',
  'project.set-status',
] as const satisfies readonly OrfeCommandName[];

export const COMMAND_CONTRACTS: Record<OrfeCommandName, CommandContract> = {
  'issue.get': {
    validInput: { issue_number: 13 },
    successDataExample: {
      issue_number: 13,
      title: 'Design the `orfe` custom tool and CLI contract',
      body: '...',
      state: 'open',
      state_reason: null,
      labels: ['needs-input'],
      assignees: ['greg'],
      html_url: 'https://github.com/throw-if-null/orfe/issues/13',
    },
  },
  'issue.create': {
    validInput: { title: 'New issue title' },
    successDataExample: {
      issue_number: 21,
      title: 'New issue title',
      state: 'open',
      html_url: 'https://github.com/throw-if-null/orfe/issues/21',
      created: true,
    },
  },
  'issue.update': {
    validInput: { issue_number: 13, title: 'Updated title' },
    successDataExample: {
      issue_number: 13,
      title: 'Updated title',
      state: 'open',
      html_url: 'https://github.com/throw-if-null/orfe/issues/13',
      changed: true,
    },
  },
  'issue.comment': {
    validInput: { issue_number: 13, body: 'Hello from orfe' },
    successDataExample: {
      issue_number: 13,
      comment_id: 123456,
      html_url: 'https://github.com/throw-if-null/orfe/issues/13#issuecomment-123456',
      created: true,
    },
  },
  'issue.set-state': {
    validInput: { issue_number: 13, state: 'closed', state_reason: 'completed' },
    successDataExample: {
      issue_number: 13,
      state: 'closed',
      state_reason: 'completed',
      duplicate_of_issue_number: null,
      changed: true,
    },
  },
  'pr.get': {
    validInput: { pr_number: 9 },
    successDataExample: {
      pr_number: 9,
      title: 'Design the `orfe` custom tool and CLI contract',
      body: '...',
      state: 'open',
      draft: false,
      head: 'issues/orfe-13',
      base: 'main',
      html_url: 'https://github.com/throw-if-null/orfe/pull/9',
    },
  },
  'pr.get-or-create': {
    validInput: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
    successDataExample: {
      pr_number: 9,
      html_url: 'https://github.com/throw-if-null/orfe/pull/9',
      head: 'issues/orfe-13',
      base: 'main',
      draft: false,
      created: false,
    },
  },
  'pr.comment': {
    validInput: { pr_number: 9, body: 'Hello from orfe' },
    successDataExample: {
      pr_number: 9,
      comment_id: 123456,
      html_url: 'https://github.com/throw-if-null/orfe/pull/9#issuecomment-123456',
      created: true,
    },
  },
  'pr.submit-review': {
    validInput: { pr_number: 9, event: 'approve', body: 'Looks good' },
    successDataExample: {
      pr_number: 9,
      review_id: 555,
      event: 'approve',
      submitted: true,
    },
  },
  'pr.reply': {
    validInput: { pr_number: 9, comment_id: 123456, body: 'ack' },
    successDataExample: {
      pr_number: 9,
      comment_id: 123999,
      in_reply_to_comment_id: 123456,
      created: true,
    },
  },
  'project.get-status': {
    validInput: { item_type: 'issue', item_number: 13 },
    successDataExample: {
      project_owner: 'throw-if-null',
      project_number: 1,
      status_field_name: 'Status',
      item_type: 'issue',
      item_number: 13,
      status: 'In Progress',
    },
  },
  'project.set-status': {
    validInput: { item_type: 'issue', item_number: 13, status: 'In Progress' },
    successDataExample: {
      project_owner: 'throw-if-null',
      project_number: 1,
      status_field_name: 'Status',
      item_type: 'issue',
      item_number: 13,
      status: 'In Progress',
      previous_status: 'Todo',
      changed: true,
    },
  },
};

export function getCommandContract(commandName: OrfeCommandName): CommandContract {
  return COMMAND_CONTRACTS[commandName];
}
