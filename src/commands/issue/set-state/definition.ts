import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { validateIssueSetStateInput } from './errors.js';
import { handleIssueSetState } from './handler.js';

export const issueSetStateCommand = createCommandDefinition({
  name: 'issue set-state',
  purpose: 'Set issue open or closed state.',
  usage:
    'orfe issue set-state --issue-number <number> --state <open|closed> [--state-reason <completed|not_planned|duplicate>] [--duplicate-of <issue-number>] [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON state-change result.',
  examples: ['ORFE_CALLER_NAME=Greg orfe issue set-state --issue-number 14 --state closed --state-reason completed'],
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
    createRepoOption(),
  ],
  validInputExample: { issue_number: 13, state: 'closed', state_reason: 'completed' },
  successDataExample: {
    issue_number: 13,
    state: 'closed',
    state_reason: 'completed',
    duplicate_of_issue_number: null,
    changed: true,
  },
  validate: validateIssueSetStateInput,
  handler: handleIssueSetState,
});
