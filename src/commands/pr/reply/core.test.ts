import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { runCoreCommand } from '../../../../test/support/command-runtime.js';
import { mockPullRequestReplyRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';

test('runOrfeCore replies to a pull request review comment and returns structured success output', async () => {
  await withNock(async () => {
    const api = mockPullRequestReplyRequest({ prNumber: 9, commentId: 123456, body: 'ack' });

    const result = await runCoreCommand({
      command: 'pr reply',
      input: { pr_number: 9, comment_id: 123456, body: 'ack' },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr reply',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        comment_id: 123999,
        in_reply_to_comment_id: 123456,
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps pr reply missing pull requests clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestReplyRequest({
      prNumber: 404,
      commentId: 123456,
      body: 'ack',
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr reply',
        input: { pr_number: 404, comment_id: 123456, body: 'ack' },
      }),
      /Pull request #404 was not found\./,
    );

    assert.equal(api.isDone(), false);
  });
});

test('runOrfeCore maps pr reply missing review comments clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestReplyRequest({
      prNumber: 9,
      commentId: 123456,
      body: 'ack',
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr reply',
        input: { pr_number: 9, comment_id: 123456, body: 'ack' },
      }),
      /Review comment #123456 was not found on pull request #9\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps pr reply auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestReplyRequest({
      prNumber: 9,
      commentId: 123456,
      body: 'ack',
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr reply',
        input: { pr_number: 9, comment_id: 123456, body: 'ack' },
      }),
      /GitHub App authentication failed while replying to review comment #123456 on pull request #9\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore rejects non-repliable pr reply targets clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestReplyRequest({
      prNumber: 9,
      commentId: 123456,
      body: 'ack',
      status: 422,
      responseBody: { message: 'Validation Failed' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr reply',
        input: { pr_number: 9, comment_id: 123456, body: 'ack' },
      }),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_conflict');
        assert.equal(
          error.message,
          'GitHub rejected reply to review comment #123456 on pull request #9: Validation Failed',
        );
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  });
});
