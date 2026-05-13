import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { issueGetCommand } from './definition.js';

test('issue get definition keeps issue_number required and repo optional', () => {
  assertDefinitionIdentity(issueGetCommand, { name: 'issue get', group: 'issue', leaf: 'get', execution: 'github' });
  assertOption(issueGetCommand, 'issue_number', { flag: '--issue-number', type: 'number', required: true });
  assertOption(issueGetCommand, 'repo', { flag: '--repo', type: 'string' });
  assertValidInputExample(issueGetCommand);
  assert.equal(issueGetCommand.successDataExample.issue_number, 13);
});
