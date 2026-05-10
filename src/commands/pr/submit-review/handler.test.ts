import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockPullRequestSubmitReviewRequest } from '../mocks/github.js';

test('runOrfeCore submits a pull request review and returns structured success output', async () => {
  await withNock(async () => {
    const api = mockPullRequestSubmitReviewRequest({ prNumber: 9, body: 'Looks good', event: 'APPROVE' });

    const result = await runCoreCommand({
      command: 'pr submit-review',
      input: { pr_number: 9, event: 'approve', body: 'Looks good' },
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

test('runOrfeCore rejects invalid pr submit-review events clearly', async () => {
  await assert.rejects(
    runCoreCommand({
      command: 'pr submit-review',
      input: { pr_number: 9, event: 'dismiss', body: 'nope' },
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'invalid_input');
      assert.equal(error.message, 'Review event must be one of: approve, request-changes, comment.');
      return true;
    },
  );
});

test('runOrfeCore maps pr submit-review missing pull requests clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestSubmitReviewRequest({
      prNumber: 404,
      body: 'Looks good',
      event: 'APPROVE',
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr submit-review',
        input: { pr_number: 404, event: 'approve', body: 'Looks good' },
      }),
      /Pull request #404 was not found\./,
    );

    assert.equal(api.isDone(), false);
  });
});

test('runOrfeCore maps pr submit-review auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestSubmitReviewRequest({
      prNumber: 9,
      body: 'Looks good',
      event: 'APPROVE',
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr submit-review',
        input: { pr_number: 9, event: 'approve', body: 'Looks good' },
      }),
      /GitHub App authentication failed while submitting a review on pull request #9\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps pr submit-review internal failures clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestSubmitReviewRequest({
      prNumber: 9,
      body: 'Looks good',
      event: 'APPROVE',
      status: 422,
      responseBody: { message: 'Validation Failed' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr submit-review',
        input: { pr_number: 9, event: 'approve', body: 'Looks good' },
      }),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'internal_error');
        assert.equal(error.message, 'GitHub API request failed with status 422: Validation Failed');
        assert.equal(error.retryable, false);
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured success JSON for pr submit-review', async () => {
  await withNock(async () => {
    const api = mockPullRequestSubmitReviewRequest({ prNumber: 9, body: 'Looks good', event: 'APPROVE' });

    const result = await invokeCli(['pr', 'submit-review', '--pr-number', '9', '--event', 'approve', '--body', 'Looks good'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
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

test('runCli prints structured not-found failures for pr submit-review', async () => {
  await withNock(async () => {
    const api = mockPullRequestSubmitReviewRequest({
      prNumber: 404,
      body: 'Looks good',
      event: 'APPROVE',
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    const result = await invokeCli(['pr', 'submit-review', '--pr-number', '404', '--event', 'approve', '--body', 'Looks good'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'pr submit-review',
      error: {
        code: 'github_not_found',
        message: 'Pull request #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  });
});

test('runCli prints structured auth failures for pr submit-review', async () => {
  await withNock(async () => {
    const api = mockPullRequestSubmitReviewRequest({
      prNumber: 9,
      body: 'Looks good',
      event: 'APPROVE',
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    const result = await invokeCli(['pr', 'submit-review', '--pr-number', '9', '--event', 'approve', '--body', 'Looks good'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'pr submit-review',
      error: {
        code: 'auth_failed',
        message: 'GitHub App authentication failed while submitting a review on pull request #9.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured config failures for pr submit-review', async () => {
  const result = await invokeCli(['pr', 'submit-review', '--pr-number', '9', '--event', 'approve', '--body', 'Looks good'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: 'pr submit-review',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli formats core invalid_input errors as structured failures for pr submit-review', async () => {
  const result = await invokeCli(['pr', 'submit-review', '--pr-number', '9', '--event', 'dismiss', '--body', 'Looks good'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: 'pr submit-review',
    error: {
      code: 'invalid_input',
      message: 'Review event must be one of: approve, request-changes, comment.',
      retryable: false,
    },
  });
});

test('runCli reports malformed pr submit-review event values as structured invalid_input failures', async () => {
  const result = await invokeCli(['pr', 'submit-review', '--pr-number', '9', '--event', 'nope', '--body', 'ok'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: 'pr submit-review',
    error: {
      code: 'invalid_input',
      message: 'Review event must be one of: approve, request-changes, comment.',
      retryable: false,
    },
  });
});
