import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handlePrComment } from './handler.js';

export const prCommentCommand = createCommandDefinition({
  name: 'pr comment',
  purpose: 'Add a top-level pull request comment.',
  usage: 'orfe pr comment --pr-number <number> --body <text> [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON comment result.',
  examples: ['ORFE_CALLER_NAME=Greg orfe pr comment --pr-number 9 --body "hello"'],
  options: [
    { key: 'pr_number', flag: '--pr-number', description: 'Pull request number.', type: 'number', required: true },
    { key: 'body', flag: '--body', description: 'Comment body.', type: 'string', required: true },
    createRepoOption(),
  ],
  validInputExample: { pr_number: 9, body: 'Hello from orfe' },
  successDataExample: {
    pr_number: 9,
    comment_id: 123456,
    html_url: 'https://github.com/throw-if-null/orfe/pull/9#issuecomment-123456',
    created: true,
  },
  handler: handlePrComment,
});
