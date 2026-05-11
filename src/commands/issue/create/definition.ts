import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handleIssueCreate } from './handler.js';

export const issueCreateCommand = createCommandDefinition({
  name: 'issue create',
  purpose: 'Create a generic issue.',
  usage:
    'orfe issue create --title <text> [--body <text>] [--template <name@version>] [--label <name> ...] [--assignee <login> ...] [--add-to-project] [--project-owner <login>] [--project-number <number>] [--status-field-name <name>] [--status <value>] [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON create result.',
  examples: [
    'ORFE_CALLER_NAME=Greg orfe issue create --title "New issue"',
    'ORFE_CALLER_NAME=Greg orfe issue create --title "New issue" --body "## Problem / context\n..." --template formal-work-item@1.0.0',
    'ORFE_CALLER_NAME=Greg orfe issue create --title "New issue" --add-to-project --status "Todo"',
  ],
  options: [
    { key: 'title', flag: '--title', description: 'Issue title.', type: 'string', required: true },
    { key: 'body', flag: '--body', description: 'Issue body.', type: 'string' },
    {
      key: 'template',
      flag: '--template',
      description: 'Validate issue body against a versioned template and append provenance.',
      type: 'string',
    },
    { key: 'labels', flag: '--label', description: 'Issue label.', type: 'string-array' },
    { key: 'assignees', flag: '--assignee', description: 'Issue assignee.', type: 'string-array' },
    { key: 'add_to_project', flag: '--add-to-project', description: 'Add the created issue to a GitHub Project.', type: 'boolean' },
    { key: 'project_owner', flag: '--project-owner', description: 'Project owner.', type: 'string' },
    { key: 'project_number', flag: '--project-number', description: 'Project number.', type: 'number' },
    { key: 'status_field_name', flag: '--status-field-name', description: 'Status field name.', type: 'string' },
    { key: 'status', flag: '--status', description: 'Initial project status value.', type: 'string' },
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
