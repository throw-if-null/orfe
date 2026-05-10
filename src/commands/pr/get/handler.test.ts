import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockPullRequestGetRequest } from '../mocks/github.js';

test('runOrfeCore reads a pull request and returns structured success output', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetRequest({ prNumber: 9 });

    const result = await runCoreCommand({
      command: 'pr get',
      input: { pr_number: 9 },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr get',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: 'issues/orfe-13',
        base: 'main',
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('executeOrfeTool returns the shared success envelope for pr get', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetRequest({ prNumber: 9 });

    const result = await runToolCommand({
      input: { command: 'pr get', pr_number: 9 },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr get',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: 'issues/orfe-13',
        base: 'main',
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps pr get not-found responses clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetRequest({
      prNumber: 999,
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr get',
        input: { pr_number: 999 },
      }),
      /Pull request #999 was not found\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps pr get auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetRequest({
      prNumber: 9,
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr get',
        input: { pr_number: 9 },
      }),
      /GitHub App authentication failed while reading pull request #9\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured success JSON for pr get', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetRequest({ prNumber: 9 });

    const result = await invokeCli(['pr', 'get', '--pr-number', '9'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'pr get',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: 'issues/orfe-13',
        base: 'main',
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured not-found failures for pr get', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetRequest({
      prNumber: 404,
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    const result = await invokeCli(['pr', 'get', '--pr-number', '404'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'pr get',
      error: {
        code: 'github_not_found',
        message: 'Pull request #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured auth failures for pr get', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetRequest({
      prNumber: 9,
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    const result = await invokeCli(['pr', 'get', '--pr-number', '9'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'pr get',
      error: {
        code: 'auth_failed',
        message: 'GitHub App authentication failed while reading pull request #9.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli reports missing required options for pr get as usage errors', async () => {
  const result = await invokeCli(['pr', 'get'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Missing required option "--pr-number"\./);
  assert.match(result.stderr, /Usage: orfe pr get --pr-number <number>/);
  assert.match(result.stderr, /See: orfe pr get --help/);
});

test('runCli prints structured config failures for pr get', async () => {
  const result = await invokeCli(['pr', 'get', '--pr-number', '9'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: 'pr get',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});
