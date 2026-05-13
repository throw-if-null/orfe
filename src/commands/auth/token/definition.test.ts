import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { authTokenCommand } from './definition.js';

test('auth token definition requires repo input and exposes token metadata examples', () => {
  assertDefinitionIdentity(authTokenCommand, { name: 'auth token', group: 'auth', leaf: 'token', execution: 'github' });
  assertOption(authTokenCommand, 'repo', { flag: '--repo', type: 'string', required: true });
  assertValidInputExample(authTokenCommand);
  assert.equal(authTokenCommand.successDataExample.app_slug, 'GR3G-BOT');
});
