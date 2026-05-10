import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockPullRequestReplyRequest } from '../mocks/github.js';

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

test('executeOrfeTool returns the shared success envelope for pr reply', async () => {
  await withNock(async () => {
    const api = mockPullRequestReplyRequest({ prNumber: 9, commentId: 123456, body: 'ack' });

    const result = await runToolCommand({
      input: { command: 'pr reply', pr_number: 9, comment_id: 123456, body: 'ack' },
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

test('runCli prints structured success JSON for pr reply', async () => {
  await withNock(async () => {
    const api = mockPullRequestReplyRequest({ prNumber: 9, commentId: 123456, body: 'ack' });

    const result = await invokeCli(['pr', 'reply', '--pr-number', '9', '--comment-id', '123456', '--body', 'ack'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
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

test('runCli prints structured not-found failures for pr reply', async () => {
  await withNock(async () => {
    const api = mockPullRequestReplyRequest({
      prNumber: 9,
      commentId: 123456,
      body: 'ack',
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    const result = await invokeCli(['pr', 'reply', '--pr-number', '9', '--comment-id', '123456', '--body', 'ack'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'pr reply',
      error: {
        code: 'github_not_found',
        message: 'Review comment #123456 was not found on pull request #9.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli reports missing required options for pr reply as usage errors', async () => {
  const result = await invokeCli(['pr', 'reply', '--pr-number', '9', '--body', 'ack'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Missing required option "--comment-id"\./);
  assert.match(result.stderr, /Usage: orfe pr reply --pr-number <number> --comment-id <number> --body <text>/);
  assert.match(result.stderr, /See: orfe pr reply --help/);
});

test('runCli prints structured config failures for pr reply', async () => {
  const result = await invokeCli(['pr', 'reply', '--pr-number', '9', '--comment-id', '123456', '--body', 'ack'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: 'pr reply',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});
