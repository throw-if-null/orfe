import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
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

test('runCli prints structured success JSON for issue comment', async () => {
  await withNock(async () => {
    const api = mockIssueCommentRequest({ issueNumber: 14, body: 'Hello from orfe' });

    const result = await invokeCli(['issue', 'comment', '--issue-number', '14', '--body', 'Hello from orfe'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
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

test('runCli prints structured not-found failures for issue comment', async () => {
  await withNock(async () => {
    const api = mockIssueCommentRequest({
      issueNumber: 404,
      body: 'Hello from orfe',
      issueGetStatus: 404,
      issueGetResponseBody: { message: 'Not Found' },
    });

    const result = await invokeCli(['issue', 'comment', '--issue-number', '404', '--body', 'Hello from orfe'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'issue comment',
      error: {
        code: 'github_not_found',
        message: 'Issue #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  });
});

test('runCli prints structured pull-request boundary failures for issue comment', async () => {
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

    const result = await invokeCli(['issue', 'comment', '--issue-number', '46', '--body', 'Hello from orfe'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'issue comment',
      error: {
        code: 'github_conflict',
        message: 'Issue #46 is a pull request. Use pr comment instead.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  });
});

test('runCli formats core invalid_usage errors as CLI usage failures for issue comment', async () => {
  const result = await invokeCli(['issue', 'comment', '--issue-number', '14', '--body', '   '], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Option "body" must be a non-empty string\./);
  assert.match(result.stderr, /Usage: orfe issue comment --issue-number <number> --body <text>/);
  assert.match(result.stderr, /Example: ORFE_CALLER_NAME=Greg orfe issue comment --issue-number 14 --body "hello"/);
  assert.match(result.stderr, /See: orfe issue comment --help/);
});

test('runCli prints structured config failures for issue comment', async () => {
  const result = await invokeCli(['issue', 'comment', '--issue-number', '14', '--body', 'Hello from orfe'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: 'issue comment',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});
