import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { prGetCommand } from './definition.js';

test('pr get definition keeps pr_number required and repo optional', () => {
  assertDefinitionIdentity(prGetCommand, { name: 'pr get', group: 'pr', leaf: 'get', execution: 'github' });
  assertOption(prGetCommand, 'pr_number', { flag: '--pr-number', type: 'number', required: true });
  assertOption(prGetCommand, 'repo', { flag: '--repo', type: 'string' });
  assertValidInputExample(prGetCommand);
  assert.equal(prGetCommand.successDataExample.pr_number, 9);
});
