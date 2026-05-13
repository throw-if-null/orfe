import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { prReplyCommand } from './definition.js';

test('pr reply definition requires pr_number, comment_id, and body', () => {
  assertDefinitionIdentity(prReplyCommand, { name: 'pr reply', group: 'pr', leaf: 'reply', execution: 'github' });
  assertOption(prReplyCommand, 'pr_number', { flag: '--pr-number', type: 'number', required: true });
  assertOption(prReplyCommand, 'comment_id', { flag: '--comment-id', type: 'number', required: true });
  assertOption(prReplyCommand, 'body', { flag: '--body', type: 'string', required: true });
  assertValidInputExample(prReplyCommand);
  assert.equal(prReplyCommand.successDataExample.in_reply_to_comment_id, 123456);
});
