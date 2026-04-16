import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handleIssueGet } from './handler.js';

export const issueGetCommand = createCommandDefinition({
  name: 'issue get',
  purpose: 'Read one issue.',
  usage: 'orfe issue get --issue-number <number> [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON issue payload.',
  examples: ['ORFE_CALLER_NAME=Greg orfe issue get --issue-number 14'],
  options: [
    { key: 'issue_number', flag: '--issue-number', description: 'Issue number.', type: 'number', required: true },
    createRepoOption(),
  ],
  validInputExample: { issue_number: 13 },
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
  handler: handleIssueGet,
});
