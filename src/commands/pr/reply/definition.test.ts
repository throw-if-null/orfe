import assert from 'node:assert/strict';
import test from 'node:test';

import { prReplyCommand } from './definition.js';

test('pr reply slice owns its command metadata and contract examples', () => {
  assert.equal(prReplyCommand.name, 'pr reply');
  assert.equal(prReplyCommand.group, 'pr');
  assert.equal(prReplyCommand.leaf, 'reply');
  assert.deepEqual(prReplyCommand.validInputExample, { pr_number: 9, comment_id: 123456, body: 'ack' });
  assert.deepEqual(prReplyCommand.successDataExample, {
    pr_number: 9,
    comment_id: 123999,
    in_reply_to_comment_id: 123456,
    created: true,
  });
});
