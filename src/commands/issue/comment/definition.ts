import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handleIssueComment } from './handler.js';

export const issueCommentCommand = createCommandDefinition({
  name: 'issue comment',
  purpose: 'Add a top-level issue comment.',
  usage: 'orfe issue comment --issue-number <number> --body <text> [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON comment result.',
  examples: ['ORFE_CALLER_NAME=Greg orfe issue comment --issue-number 14 --body "hello"'],
  options: [
    { key: 'issue_number', flag: '--issue-number', description: 'Issue number.', type: 'number', required: true },
    { key: 'body', flag: '--body', description: 'Comment body.', type: 'string', required: true },
    createRepoOption(),
  ],
  validInputExample: { issue_number: 13, body: 'Hello from orfe' },
  successDataExample: {
    issue_number: 13,
    comment_id: 123456,
    html_url: 'https://github.com/throw-if-null/orfe/issues/13#issuecomment-123456',
    created: true,
  },
  handler: handleIssueComment,
});
