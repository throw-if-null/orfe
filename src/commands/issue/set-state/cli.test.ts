import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import {
  createIssueRestResponse,
  createIssueStateNode,
  mockIssueSetStateDuplicateRequest,
  mockIssueSetStateRequest,
} from '../../../../test/support/github/issue.js';
import { withNock } from '../../../../test/support/http-test.js';

test('runCli prints structured success JSON for issue set-state', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      restUpdateBody: { state: 'closed', state_reason: 'completed' },
      observedIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'COMPLETED',
      }),
    });

    const result = await invokeCli(['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'completed'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'completed',
        duplicate_of_issue_number: null,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured success JSON for duplicate issue set-state', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 7,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      canonicalIssueState: createIssueStateNode({ id: 'I_7', issueNumber: 7, state: 'OPEN' }),
      mark: { duplicateId: 'I_14', canonicalId: 'I_7' },
      observedIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'DUPLICATE',
        duplicateOfIssueNumber: 7,
        duplicateOfId: 'I_7',
      }),
    });

    const result = await invokeCli(
      ['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'duplicate', '--duplicate-of', '7'],
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
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'duplicate',
        duplicate_of_issue_number: 7,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured not-found failures for issue set-state duplicate targets', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 999,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      canonicalIssueState: null,
    });

    const result = await invokeCli(
      ['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'duplicate', '--duplicate-of', '999'],
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
      command: 'issue set-state',
      error: {
        code: 'github_not_found',
        message: 'Duplicate target issue #999 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured pull-request boundary failures for duplicate issue set-state targets', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 48,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      canonicalIssueState: null,
      duplicateTargetGetStatus: 200,
      duplicateTargetGetResponseBody: createIssueRestResponse(48, {
        title: 'Implement `orfe issue set-state`',
        html_url: 'https://github.com/throw-if-null/orfe/pull/48',
        pull_request: {
          url: 'https://api.github.com/repos/throw-if-null/orfe/pulls/48',
        },
      }),
    });

    const result = await invokeCli(
      ['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'duplicate', '--duplicate-of', '48'],
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
      command: 'issue set-state',
      error: {
        code: 'github_conflict',
        message: 'Duplicate target issue #48 is a pull request. --duplicate-of must reference an issue.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured pull-request boundary failures for issue set-state', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateRequest({
      issueNumber: 46,
      currentIssueState: createIssueStateNode({ id: 'I_46', issueNumber: 46, state: 'OPEN' }),
      issueGetResponseBody: {
        number: 46,
        title: 'Implement `orfe issue set-state`',
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

    const result = await invokeCli(['issue', 'set-state', '--issue-number', '46', '--state', 'closed', '--state-reason', 'completed'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'issue set-state',
      error: {
        code: 'github_conflict',
        message: 'Issue #46 is a pull request. issue set-state only supports issues.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  });
});

test('runCli prints structured config failures for issue set-state', async () => {
  const result = await invokeCli(['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'completed'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: 'issue set-state',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli formats core invalid_usage errors as CLI usage failures', async () => {
  const result = await invokeCli(['issue', 'set-state', '--issue-number', '14', '--state', 'open', '--state-reason', 'completed'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /state_reason/);
  assert.match(result.stderr, /Usage: orfe issue set-state/);
  assert.match(result.stderr, /Example: ORFE_CALLER_NAME=Greg orfe issue set-state --issue-number 14 --state closed --state-reason completed/);
  assert.match(result.stderr, /See: orfe issue set-state --help/);
});

test('runCli requires --duplicate-of when closing an issue as duplicate', async () => {
  const result = await invokeCli(['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'duplicate'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /issue set-state requires --duplicate-of when state_reason=duplicate\./);
  assert.match(result.stderr, /Usage: orfe issue set-state/);
  assert.match(result.stderr, /See: orfe issue set-state --help/);
});

test('runCli rejects marking an issue as a duplicate of itself', async () => {
  const result = await invokeCli(
    ['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'duplicate', '--duplicate-of', '14'],
    {
      env: { ORFE_CALLER_NAME: 'Greg' },
      loadRepoConfigImpl: async () => {
        throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
      },
    },
  );

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /issue set-state cannot mark an issue as a duplicate of itself\./);
  assert.match(result.stderr, /Usage: orfe issue set-state/);
  assert.match(result.stderr, /See: orfe issue set-state --help/);
});
