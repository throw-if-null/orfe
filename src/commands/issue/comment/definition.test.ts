import assert from 'node:assert/strict';
import test from 'node:test';

import { issueCommentCommand } from './definition.js';

test('issue comment slice owns its command metadata and contract examples', () => {
  assert.equal(issueCommentCommand.name, 'issue comment');
  assert.equal(issueCommentCommand.group, 'issue');
  assert.equal(issueCommentCommand.leaf, 'comment');
  assert.deepEqual(issueCommentCommand.validInputExample, { issue_number: 13, body: 'Hello from orfe' });
  assert.deepEqual(issueCommentCommand.successDataExample, {
    issue_number: 13,
    comment_id: 123456,
    html_url: 'https://github.com/throw-if-null/orfe/issues/13#issuecomment-123456',
    created: true,
  });
});
