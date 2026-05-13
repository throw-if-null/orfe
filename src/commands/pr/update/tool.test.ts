import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import { mockPullRequestUpdateRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';

test('executeOrfeTool returns the shared success envelope for pr update', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {
        title: 'Updated PR title',
      },
    });

    const result = await runToolCommand({
      input: {
        command: 'pr update',
        pr_number: 9,
        title: 'Updated PR title',
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr update',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        title: 'Updated PR title',
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        head: 'issues/orfe-13',
        base: 'main',
        draft: false,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});
