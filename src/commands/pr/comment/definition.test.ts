import assert from 'node:assert/strict';
import { test } from 'vitest';

import { prCommentCommand } from './definition.js';

test('pr comment slice owns its command metadata and contract examples', () => {
  assert.equal(prCommentCommand.name, 'pr comment');
  assert.equal(prCommentCommand.group, 'pr');
  assert.equal(prCommentCommand.leaf, 'comment');
  assert.deepEqual(prCommentCommand.validInputExample, { pr_number: 9, body: 'Hello from orfe' });
  assert.deepEqual(prCommentCommand.successDataExample, {
    pr_number: 9,
    comment_id: 123456,
    html_url: 'https://github.com/throw-if-null/orfe/pull/9#issuecomment-123456',
    created: true,
  });
});
