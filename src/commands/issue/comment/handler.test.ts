import assert from 'node:assert/strict';
import { test } from 'vitest';

import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { mockIssueCommentRequest } from '../mocks/github.js';

test('runOrfeCore posts a generic issue comment and returns structured success output', async () => {
  await withNock(async () => {
    const api = mockIssueCommentRequest({ issueNumber: 14, body: 'Hello from orfe' });

    const result = await runCoreCommand({
      command: 'issue comment',
      input: { issue_number: 14, body: 'Hello from orfe' },
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

test('runOrfeCore maps issue comment not-found responses clearly', async () => {
  await withNock(async () => {
    const api = mockIssueCommentRequest({
      issueNumber: 999,
      body: 'Hello from orfe',
      issueGetStatus: 404,
      issueGetResponseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue comment',
        input: { issue_number: 999, body: 'Hello from orfe' },
      }),
      /Issue #999 was not found\./,
    );

    assert.equal(api.isDone(), false);
  });
});

test('runOrfeCore maps issue comment auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockIssueCommentRequest({
      issueNumber: 14,
      body: 'Hello from orfe',
      issueGetStatus: 403,
      issueGetResponseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue comment',
        input: { issue_number: 14, body: 'Hello from orfe' },
      }),
      /GitHub App authentication failed while commenting on issue #14\./,
    );

    assert.equal(api.isDone(), false);
  });
});

test('runOrfeCore rejects pull request targets for issue comment clearly', async () => {
  await withNock(async () => {
    const api = mockIssueCommentRequest({
      issueNumber: 46,
      body: 'Hello from orfe',
      issueGetResponseBody: {
        number: 46,
        title: 'Implement `orfe issue comment`',
        body: 'PR body',
        state: 'open',
        state_reason: null,
        labels: [],
        assignees: [],
        html_url: 'https://github.com/throw-if-null/orfe/pull/46',
        pull_request: {
          url: 'https://api.github.com/repos/throw-if-null/orfe/pulls/46',
        },
      },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue comment',
        input: { issue_number: 46, body: 'Hello from orfe' },
      }),
      /Issue #46 is a pull request\. Use pr comment instead\./,
    );

    assert.equal(api.isDone(), false);
  });
});
