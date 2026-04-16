import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handlePrReply } from './handler.js';

export const prReplyCommand = createCommandDefinition({
  name: 'pr reply',
  purpose: 'Reply to an existing pull request review comment.',
  usage: 'orfe pr reply --pr-number <number> --comment-id <number> --body <text> [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON reply result.',
  examples: ['ORFE_CALLER_NAME=Greg orfe pr reply --pr-number 9 --comment-id 123 --body "ack"'],
  options: [
    { key: 'pr_number', flag: '--pr-number', description: 'Pull request number.', type: 'number', required: true },
    { key: 'comment_id', flag: '--comment-id', description: 'Review comment id.', type: 'number', required: true },
    { key: 'body', flag: '--body', description: 'Reply body.', type: 'string', required: true },
    createRepoOption(),
  ],
  validInputExample: { pr_number: 9, comment_id: 123456, body: 'ack' },
  successDataExample: {
    pr_number: 9,
    comment_id: 123999,
    in_reply_to_comment_id: 123456,
    created: true,
  },
  handler: handlePrReply,
});
