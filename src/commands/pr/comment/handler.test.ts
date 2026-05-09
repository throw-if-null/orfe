import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { mockPullRequestCommentRequest } from '../../../../test/support/pr-fixtures.js';

test('runOrfeCore posts a top-level pull request comment and returns structured success output', async () => {
  await withNock(async () => {
    const api = mockPullRequestCommentRequest({ prNumber: 9, body: 'Hello from orfe' });

    const result = await runCoreCommand({
      command: 'pr comment',
      input: { pr_number: 9, body: 'Hello from orfe' },
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

test('runOrfeCore maps pr comment not-found responses clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestCommentRequest({
      prNumber: 999,
      body: 'Hello from orfe',
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr comment',
        input: { pr_number: 999, body: 'Hello from orfe' },
      }),
      /Pull request #999 was not found\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps plain-issue targets for pr comment as not found', async () => {
  await withNock(async () => {
    const api = mockPullRequestCommentRequest({
      prNumber: 14,
      body: 'Hello from orfe',
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr comment',
        input: { pr_number: 14, body: 'Hello from orfe' },
      }),
      /Pull request #14 was not found\./,
    );

    assert.equal(api.isDone(), false);
  });
});

test('runOrfeCore maps pr comment auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestCommentRequest({
      prNumber: 9,
      body: 'Hello from orfe',
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr comment',
        input: { pr_number: 9, body: 'Hello from orfe' },
      }),
      /GitHub App authentication failed while commenting on pull request #9\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore surfaces pr comment validation failures clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestCommentRequest({
      prNumber: 9,
      body: 'Hello from orfe',
      status: 422,
      responseBody: { message: 'Validation Failed' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr comment',
        input: { pr_number: 9, body: 'Hello from orfe' },
      }),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'internal_error');
        assert.equal(error.message, 'GitHub API request failed with status 422: Validation Failed');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  });
});
