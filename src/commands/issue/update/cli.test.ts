import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockIssueUpdateRequest } from '../../../../test/support/github/issue.js';
import { withNock } from '../../../../test/support/http-test.js';

test('runCli prints structured success JSON for issue update', async () => {
  await withNock(async () => {
    const api = mockIssueUpdateRequest({
      issueNumber: 14,
      requestBody: {
        title: 'Updated title',
        body: 'Updated body',
        labels: ['bug', 'needs-input'],
        assignees: ['greg'],
      },
    });

    const result = await invokeCli(
      [
        'issue',
        'update',
        '--issue-number',
        '14',
        '--title',
        'Updated title',
        '--body',
        'Updated body',
        '--label',
        'bug',
        '--label',
        'needs-input',
        '--assignee',
        'greg',
      ],
      {
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'issue update',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        title: 'Updated title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/14',
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured not-found failures for issue update', async () => {
  await withNock(async () => {
    const api = mockIssueUpdateRequest({
      issueNumber: 404,
      requestBody: { title: 'Updated title' },
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    const result = await invokeCli(['issue', 'update', '--issue-number', '404', '--title', 'Updated title'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'issue update',
      error: {
        code: 'github_not_found',
        message: 'Issue #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured pull-request boundary failures for issue update', async () => {
  await withNock(async () => {
    const api = mockIssueUpdateRequest({
      issueNumber: 46,
      requestBody: { title: 'Updated title' },
      issueGetResponseBody: {
        number: 46,
        title: 'Implement `orfe issue update`',
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

    const result = await invokeCli(['issue', 'update', '--issue-number', '46', '--title', 'Updated title'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'issue update',
      error: {
        code: 'github_conflict',
        message: 'Issue #46 is a pull request. issue update only supports issues.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  });
});

test('runCli formats core invalid_usage errors as CLI usage failures for issue update', async () => {
  const result = await invokeCli(['issue', 'update', '--issue-number', '14'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /issue update requires at least one mutation option\./);
  assert.match(result.stderr, /Usage: orfe issue update --issue-number <number>/);
  assert.match(result.stderr, /See: orfe issue update --help/);
});

test('runCli rejects conflicting issue update clear and replacement options', async () => {
  const result = await invokeCli(['issue', 'update', '--issue-number', '14', '--label', 'bug', '--clear-labels'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /does not allow labels together with --clear-labels/);
  assert.match(result.stderr, /Usage: orfe issue update --issue-number <number>/);
  assert.match(result.stderr, /See: orfe issue update --help/);
});

test('runCli prints structured config failures for issue update', async () => {
  const result = await invokeCli(['issue', 'update', '--issue-number', '14', '--title', 'Updated title'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: 'issue update',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});
