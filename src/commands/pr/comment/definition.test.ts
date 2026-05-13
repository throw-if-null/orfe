import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { prCommentCommand } from './definition.js';

test('pr comment definition requires pr_number and body', () => {
  assertDefinitionIdentity(prCommentCommand, { name: 'pr comment', group: 'pr', leaf: 'comment', execution: 'github' });
  assertOption(prCommentCommand, 'pr_number', { flag: '--pr-number', type: 'number', required: true });
  assertOption(prCommentCommand, 'body', { flag: '--body', type: 'string', required: true });
  assertValidInputExample(prCommentCommand);
  assert.equal(prCommentCommand.successDataExample.created, true);
});
