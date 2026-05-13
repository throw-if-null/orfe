import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { issueValidateCommand } from './definition.js';

test('issue validate definition keeps body validation local and auth-free', () => {
  assertDefinitionIdentity(issueValidateCommand, { name: 'issue validate', group: 'issue', leaf: 'validate', execution: 'github' });
  assertOption(issueValidateCommand, 'body', { flag: '--body', type: 'string', required: true });
  assertOption(issueValidateCommand, 'template', { flag: '--template', type: 'string' });
  assertValidInputExample(issueValidateCommand);
  assert.equal(issueValidateCommand.requiresCaller, false);
  assert.equal(issueValidateCommand.requiresAuthConfig, false);
  assert.equal(issueValidateCommand.requiresGitHubAccess, false);
  assert.equal(issueValidateCommand.successDataExample.template_source, 'explicit');
});
