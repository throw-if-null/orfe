import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockPullRequestReplyRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';

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
