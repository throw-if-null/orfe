import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { validatePrSubmitReviewInput } from './errors.js';
import { handlePrSubmitReview } from './handler.js';

export const prSubmitReviewCommand = createCommandDefinition({
  name: 'pr submit-review',
  purpose: 'Submit a completed pull request review.',
  usage: 'orfe pr submit-review --pr-number <number> --event <approve|request-changes|comment> --body <text> [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON review result.',
  examples: ['ORFE_CALLER_NAME=Greg orfe pr submit-review --pr-number 9 --event approve --body "Looks good"'],
  options: [
    { key: 'pr_number', flag: '--pr-number', description: 'Pull request number.', type: 'number', required: true },
    { key: 'event', flag: '--event', description: 'Review event.', type: 'string', required: true },
    { key: 'body', flag: '--body', description: 'Review body.', type: 'string', required: true },
    createRepoOption(),
  ],
  validInputExample: { pr_number: 9, event: 'approve', body: 'Looks good' },
  successDataExample: {
    pr_number: 9,
    review_id: 555,
    event: 'approve',
    submitted: true,
  },
  validate: validatePrSubmitReviewInput,
  handler: handlePrSubmitReview,
});
