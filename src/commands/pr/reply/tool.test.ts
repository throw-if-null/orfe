import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import { mockPullRequestReplyRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';

test('executeOrfeTool returns the shared success envelope for pr reply', async () => {
  await withNock(async () => {
    const api = mockPullRequestReplyRequest({ prNumber: 9, commentId: 123456, body: 'ack' });

    const result = await runToolCommand({
      input: { command: 'pr reply', pr_number: 9, comment_id: 123456, body: 'ack' },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr reply',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        comment_id: 123999,
        in_reply_to_comment_id: 123456,
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});
