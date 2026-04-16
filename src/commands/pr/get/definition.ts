import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handlePrGet } from './handler.js';

export const prGetCommand = createCommandDefinition({
  name: 'pr get',
  purpose: 'Read one pull request.',
  usage: 'orfe pr get --pr-number <number> [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON pull request payload.',
  examples: ['ORFE_CALLER_NAME=Greg orfe pr get --pr-number 9'],
  options: [
    { key: 'pr_number', flag: '--pr-number', description: 'Pull request number.', type: 'number', required: true },
    createRepoOption(),
  ],
  validInputExample: { pr_number: 9 },
  successDataExample: {
    pr_number: 9,
    title: 'Design the `orfe` custom tool and CLI contract',
    body: '...',
    state: 'open',
    draft: false,
    head: 'issues/orfe-13',
    base: 'main',
    html_url: 'https://github.com/throw-if-null/orfe/pull/9',
  },
  handler: handlePrGet,
});
