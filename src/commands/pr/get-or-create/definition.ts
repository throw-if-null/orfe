import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handlePrGetOrCreate } from './handler.js';

export const prGetOrCreateCommand = createCommandDefinition({
  name: 'pr get-or-create',
  purpose: 'Reuse or create a pull request for a branch pair.',
  usage: 'orfe pr get-or-create --head <branch> --title <text> [--body <text>] [--base <branch>] [--draft] [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON pull request result.',
  examples: ['ORFE_CALLER_NAME=Greg orfe pr get-or-create --head issues/orfe-14 --title "Build orfe foundation"'],
  options: [
    { key: 'head', flag: '--head', description: 'Head branch.', type: 'string', required: true },
    { key: 'title', flag: '--title', description: 'Pull request title.', type: 'string', required: true },
    { key: 'body', flag: '--body', description: 'Pull request body.', type: 'string' },
    { key: 'base', flag: '--base', description: 'Base branch.', type: 'string' },
    { key: 'draft', flag: '--draft', description: 'Create as draft.', type: 'boolean' },
    createRepoOption(),
  ],
  validInputExample: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
  successDataExample: {
    pr_number: 9,
    html_url: 'https://github.com/throw-if-null/orfe/pull/9',
    head: 'issues/orfe-13',
    base: 'main',
    draft: false,
    created: false,
  },
  handler: handlePrGetOrCreate,
});
