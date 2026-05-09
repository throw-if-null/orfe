import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { validatePrUpdateInput } from './errors.js';
import { handlePrUpdate } from './handler.js';

export const prUpdateCommand = createCommandDefinition({
  name: 'pr update',
  purpose: 'Update mutable pull request fields.',
  usage:
    'orfe pr update --pr-number <number> [--title <text>] [--body <text>] [--body-contract <name@version>] [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON pull request update result.',
  examples: [
    'ORFE_CALLER_NAME=Greg orfe pr update --pr-number 9 --title "Updated PR title"',
    'ORFE_CALLER_NAME=Greg orfe pr update --pr-number 9 --body "Ref: #142\n\n## Summary\n- ..." --body-contract implementation-ready@1.0.0',
  ],
  options: [
    { key: 'pr_number', flag: '--pr-number', description: 'Pull request number.', type: 'number', required: true },
    { key: 'title', flag: '--title', description: 'Updated pull request title.', type: 'string' },
    { key: 'body', flag: '--body', description: 'Updated pull request body.', type: 'string' },
    {
      key: 'body_contract',
      flag: '--body-contract',
      description: 'Validate PR body against a versioned contract and append provenance.',
      type: 'string',
    },
    createRepoOption(),
  ],
  validInputExample: { pr_number: 9, title: 'Updated PR title' },
  successDataExample: {
    pr_number: 9,
    title: 'Updated PR title',
    html_url: 'https://github.com/throw-if-null/orfe/pull/9',
    head: 'issues/orfe-142',
    base: 'main',
    draft: false,
    changed: true,
  },
  validate: validatePrUpdateInput,
  handler: handlePrUpdate,
});
