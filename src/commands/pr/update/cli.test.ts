import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockPullRequestUpdateRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';

test('runCli prints structured success JSON for pr update', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {
        title: 'Updated PR title',
        body: 'Updated PR body',
      },
    });

    const result = await invokeCli(['pr', 'update', '--pr-number', '9', '--title', 'Updated PR title', '--body', 'Updated PR body'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'pr update',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        title: 'Updated PR title',
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        head: 'issues/orfe-13',
        base: 'main',
        draft: false,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured template-validation failures for invalid pr update bodies', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {},
    });

    const result = await invokeCli(
      ['pr', 'update', '--pr-number', '9', '--body', 'Ref: #142\n\nCloses: #142', '--template', 'implementation-ready@1.0.0'],
      {
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'pr update',
      error: {
        code: 'template_validation_failed',
        message: 'Template validation failed: body matched forbidden pattern (?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  });
});

test('runCli prints structured not-found failures for pr update', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 404,
      requestBody: { title: 'Updated PR title' },
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    const result = await invokeCli(['pr', 'update', '--pr-number', '404', '--title', 'Updated PR title'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'pr update',
      error: {
        code: 'github_not_found',
        message: 'Pull request #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  });
});

test('runCli reports invalid option combinations for pr update as usage errors', async () => {
  const result = await invokeCli(['pr', 'update', '--pr-number', '9', '--template', 'implementation-ready@1.0.0'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /pr update only allows template together with --body\./);
  assert.match(result.stderr, /Usage: orfe pr update --pr-number <number> \[--title <text>] \[--body <text>] \[--template <name@version>] \[--repo <owner\/name>] \[--config <path>] \[--auth-config <path>]$/m);
  assert.match(result.stderr, /See: orfe pr update --help/);
});

test('runCli reports missing mutation options for pr update as usage errors', async () => {
  const result = await invokeCli(['pr', 'update', '--pr-number', '9'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /pr update requires at least one mutation option\./);
  assert.match(result.stderr, /Usage: orfe pr update --pr-number <number> \[--title <text>] \[--body <text>] \[--template <name@version>] \[--repo <owner\/name>] \[--config <path>] \[--auth-config <path>]$/m);
  assert.match(result.stderr, /See: orfe pr update --help/);
});
