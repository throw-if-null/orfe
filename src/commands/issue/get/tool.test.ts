import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import { mockIssueGetRequest } from '../../../../test/support/github/issue.js';
import { withNock } from '../../../../test/support/http-test.js';

test('executeOrfeTool returns the shared success envelope for issue get', async () => {
  await withNock(async () => {
    const api = mockIssueGetRequest({ issueNumber: 14 });

    const result = await runToolCommand({
      input: {
        command: 'issue get',
        issue_number: 14,
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue get',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        title: 'Build `orfe` foundation and runtime scaffolding',
        body: 'Issue body',
        state: 'open',
        state_reason: null,
        labels: ['needs-input'],
        assignees: ['greg'],
        html_url: 'https://github.com/throw-if-null/orfe/issues/14',
      },
    });
    assert.equal(api.isDone(), true);
  });
});
