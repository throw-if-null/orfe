import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { prValidateCommand } from './definition.js';

test('pr validate definition keeps template validation local and auth-free', () => {
  assertDefinitionIdentity(prValidateCommand, { name: 'pr validate', group: 'pr', leaf: 'validate', execution: 'github' });
  assertOption(prValidateCommand, 'body', { flag: '--body', type: 'string', required: true });
  assertOption(prValidateCommand, 'template', { flag: '--template', type: 'string' });
  assertValidInputExample(prValidateCommand);
  assert.equal(prValidateCommand.requiresCaller, false);
  assert.equal(prValidateCommand.requiresAuthConfig, false);
  assert.equal(prValidateCommand.requiresGitHubAccess, false);
  assert.equal(prValidateCommand.successDataExample.template?.template_name, 'implementation-ready');
});
