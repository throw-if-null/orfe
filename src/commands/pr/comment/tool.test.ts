import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import { mockPullRequestCommentRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';

test('executeOrfeTool returns the shared success envelope for pr comment', async () => {
  await withNock(async () => {
    const api = mockPullRequestCommentRequest({ prNumber: 9, body: 'Hello from orfe' });

    const result = await runToolCommand({
      input: { command: 'pr comment', pr_number: 9, body: 'Hello from orfe' },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr comment',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        comment_id: 123456,
        html_url: 'https://github.com/throw-if-null/orfe/pull/9#issuecomment-123456',
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});
