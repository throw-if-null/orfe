import assert from 'node:assert/strict';
import { test } from 'vitest';

import { runCoreCommand } from '../support/command-runtime.js';
import { mockIssueGetRequest } from '../support/issue-fixtures.js';
import { withNock } from '../support/http-test.js';

test('runOrfeCore can be exercised directly with plain callerName data', async () => {
  await withNock(async () => {
    const api = mockIssueGetRequest({ issueNumber: 14 });

    const result = await runCoreCommand({
      command: 'issue get',
      input: { issue_number: 14 },
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
