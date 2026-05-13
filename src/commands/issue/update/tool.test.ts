import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import { mockIssueUpdateRequest } from '../../../../test/support/github/issue.js';
import { withNock } from '../../../../test/support/http-test.js';

test('executeOrfeTool returns the shared success envelope for issue update', async () => {
  await withNock(async () => {
    const api = mockIssueUpdateRequest({
      issueNumber: 14,
      requestBody: {
        title: 'Updated title',
        labels: ['bug'],
      },
    });

    const result = await runToolCommand({
      input: {
        command: 'issue update',
        issue_number: 14,
        title: 'Updated title',
        labels: ['bug'],
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue update',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        title: 'Updated title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/14',
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});
