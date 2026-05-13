import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import { mockPullRequestGetRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';

test('executeOrfeTool returns the shared success envelope for pr get', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetRequest({ prNumber: 9 });

    const result = await runToolCommand({
      input: { command: 'pr get', pr_number: 9 },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr get',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: 'issues/orfe-13',
        base: 'main',
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
      },
    });
    assert.equal(api.isDone(), true);
  });
});
