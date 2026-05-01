import assert from 'node:assert/strict';
import { test } from 'vitest';

import { authTokenCommand } from './definition.js';

test('auth token slice owns its command metadata and contract examples', () => {
  assert.equal(authTokenCommand.name, 'auth token');
  assert.equal(authTokenCommand.group, 'auth');
  assert.equal(authTokenCommand.leaf, 'token');
  assert.deepEqual(authTokenCommand.validInputExample, { repo: 'throw-if-null/orfe' });
  assert.deepEqual(authTokenCommand.successDataExample, {
    bot: 'greg',
    app_slug: 'GR3G-BOT',
    repo: 'throw-if-null/orfe',
    token: 'ghs_123',
    expires_at: '2026-04-06T12:00:00Z',
    auth_mode: 'github-app',
  });
});
