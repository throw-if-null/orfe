import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { validateIssueUpdateInput } from './errors.js';
import { handleIssueUpdate } from './handler.js';

export const issueUpdateCommand = createCommandDefinition({
  name: 'issue update',
  purpose: 'Update mutable issue fields without changing state.',
  usage:
    'orfe issue update --issue-number <number> [--title <text>] [--body <text>] [--label <name> ...] [--assignee <login> ...] [--clear-labels] [--clear-assignees] [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON update result.',
  examples: ['ORFE_CALLER_NAME=Greg orfe issue update --issue-number 14 --title "Updated title"'],
  options: [
    { key: 'issue_number', flag: '--issue-number', description: 'Issue number.', type: 'number', required: true },
    { key: 'title', flag: '--title', description: 'Updated title.', type: 'string' },
    { key: 'body', flag: '--body', description: 'Updated body.', type: 'string' },
    { key: 'labels', flag: '--label', description: 'Replacement labels.', type: 'string-array' },
    { key: 'assignees', flag: '--assignee', description: 'Replacement assignees.', type: 'string-array' },
    { key: 'clear_labels', flag: '--clear-labels', description: 'Clear all labels.', type: 'boolean' },
    { key: 'clear_assignees', flag: '--clear-assignees', description: 'Clear all assignees.', type: 'boolean' },
    createRepoOption(),
  ],
  validInputExample: { issue_number: 13, title: 'Updated title' },
  successDataExample: {
    issue_number: 13,
    title: 'Updated title',
    state: 'open',
    html_url: 'https://github.com/throw-if-null/orfe/issues/13',
    changed: true,
  },
  validate: validateIssueUpdateInput,
  handler: handleIssueUpdate,
});
