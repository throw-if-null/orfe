import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import { mockIssueCommentRequest } from '../../../../test/support/github/issue.js';
import { withNock } from '../../../../test/support/http-test.js';

test('executeOrfeTool returns the shared success envelope for issue comment', async () => {
  await withNock(async () => {
    const api = mockIssueCommentRequest({ issueNumber: 14, body: 'Hello from orfe' });

    const result = await runToolCommand({
      input: { command: 'issue comment', issue_number: 14, body: 'Hello from orfe' },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue comment',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        comment_id: 123456,
        html_url: 'https://github.com/throw-if-null/orfe/issues/14#issuecomment-123456',
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});
