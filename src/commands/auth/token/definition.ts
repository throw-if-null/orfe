import { handleAuthToken } from './handler.js';
import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';

export const authTokenCommand = createCommandDefinition({
  name: 'auth token',
  purpose: 'Mint a GitHub App installation token for the resolved caller bot and repository.',
  usage: 'orfe auth token --repo <owner/name> [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints structured JSON token metadata and the minted token.',
  examples: ['ORFE_CALLER_NAME=Greg orfe auth token --repo throw-if-null/orfe'],
  options: [createRepoOption(true)],
  validInputExample: { repo: 'throw-if-null/orfe' },
  successDataExample: {
    bot: 'greg',
    app_slug: 'GR3G-BOT',
    repo: 'throw-if-null/orfe',
    token: 'ghs_123',
    expires_at: '2026-04-06T12:00:00Z',
    auth_mode: 'github-app',
  },
  handler: handleAuthToken,
});
