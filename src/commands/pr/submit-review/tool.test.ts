import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import { mockPullRequestSubmitReviewRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';

test('executeOrfeTool returns the shared success envelope for pr submit-review', async () => {
  await withNock(async () => {
    const api = mockPullRequestSubmitReviewRequest({ prNumber: 9, body: 'Looks good', event: 'APPROVE' });

    const result = await runToolCommand({
      input: { command: 'pr submit-review', pr_number: 9, event: 'approve', body: 'Looks good' },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr submit-review',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        review_id: 555,
        event: 'approve',
        submitted: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});
