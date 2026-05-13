import assert from 'node:assert/strict';

import { test } from 'vitest';

import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockPullRequestCommentRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';

test('runCli prints structured success JSON for pr comment', async () => {
  await withNock(async () => {
    const api = mockPullRequestCommentRequest({ prNumber: 9, body: 'Hello from orfe' });

    const result = await invokeCli(['pr', 'comment', '--pr-number', '9', '--body', 'Hello from orfe'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
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

test('runCli prints structured not-found failures for pr comment', async () => {
  await withNock(async () => {
    const api = mockPullRequestCommentRequest({
      prNumber: 404,
      body: 'Hello from orfe',
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    const result = await invokeCli(['pr', 'comment', '--pr-number', '404', '--body', 'Hello from orfe'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'pr comment',
      error: {
        code: 'github_not_found',
        message: 'Pull request #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  });
});
