import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handleIssueCreate } from './handler.js';

export const issueCreateCommand = createCommandDefinition({
  name: 'issue create',
  purpose: 'Create a generic issue.',
  usage:
    'orfe issue create --title <text> [--body <text>] [--body-contract <name@version>] [--label <name> ...] [--assignee <login> ...] [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON create result.',
  examples: [
    'ORFE_CALLER_NAME=Greg orfe issue create --title "New issue"',
    'ORFE_CALLER_NAME=Greg orfe issue create --title "New issue" --body "## Problem / context\n..." --body-contract formal-work-item@1.0.0',
  ],
  options: [
    { key: 'title', flag: '--title', description: 'Issue title.', type: 'string', required: true },
    { key: 'body', flag: '--body', description: 'Issue body.', type: 'string' },
    {
      key: 'body_contract',
      flag: '--body-contract',
      description: 'Validate issue body against a versioned contract and append provenance.',
      type: 'string',
    },
    { key: 'labels', flag: '--label', description: 'Issue label.', type: 'string-array' },
    { key: 'assignees', flag: '--assignee', description: 'Issue assignee.', type: 'string-array' },
    createRepoOption(),
  ],
  validInputExample: { title: 'New issue title' },
  successDataExample: {
    issue_number: 21,
    title: 'New issue title',
    state: 'open',
    html_url: 'https://github.com/throw-if-null/orfe/issues/21',
    created: true,
  },
  handler: handleIssueCreate,
});
