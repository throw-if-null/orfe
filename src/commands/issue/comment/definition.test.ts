import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { issueCommentCommand } from './definition.js';

test('issue comment definition requires issue_number and body', () => {
  assertDefinitionIdentity(issueCommentCommand, { name: 'issue comment', group: 'issue', leaf: 'comment', execution: 'github' });
  assertOption(issueCommentCommand, 'issue_number', { flag: '--issue-number', type: 'number', required: true });
  assertOption(issueCommentCommand, 'body', { flag: '--body', type: 'string', required: true });
  assertValidInputExample(issueCommentCommand);
  assert.equal(issueCommentCommand.successDataExample.created, true);
});
