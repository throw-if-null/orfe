import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockIssueUpdateRequest } from '../mocks/github.js';
import { renderIssueBodyContractMarker } from '../../../../test/support/runtime-fixtures.js';

test('runOrfeCore updates issue metadata and returns structured success output', async () => {
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

    const result = await runCoreCommand({
      command: 'issue update',
      input: {
        issue_number: 14,
        title: 'Updated title',
        body: 'Updated body',
        labels: ['bug', 'needs-input'],
        assignees: ['greg'],
      },
    });

    assert.deepEqual(result, {
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

test('executeOrfeTool returns the shared success envelope for issue update', async () => {
  await withNock(async () => {
    const api = mockIssueUpdateRequest({
      issueNumber: 14,
      requestBody: {
        title: 'Updated title',
        labels: ['bug'],
      },
    });

    const result = await runToolCommand({
      input: {
        command: 'issue update',
        issue_number: 14,
        title: 'Updated title',
        labels: ['bug'],
      },
    });

    assert.deepEqual(result, {
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

test('runOrfeCore clears labels and assignees for issue update', async () => {
  await withNock(async () => {
    const api = mockIssueUpdateRequest({
      issueNumber: 14,
      requestBody: {
        labels: [],
        assignees: [],
      },
      responseBody: {
        number: 14,
        title: 'Build `orfe` foundation and runtime scaffolding',
        body: 'Issue body',
        state: 'open',
        state_reason: null,
        labels: [],
        assignees: [],
        html_url: 'https://github.com/throw-if-null/orfe/issues/14',
      },
    });

    const result = await runCoreCommand({
      command: 'issue update',
      input: {
        issue_number: 14,
        clear_labels: true,
        clear_assignees: true,
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue update',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        title: 'Build `orfe` foundation and runtime scaffolding',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/14',
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore allows provenance-only issue-update validation when no explicit contract is provided', async () => {
  await withNock(async () => {
    const issueBody = [
      '## Problem / context',
      '',
      'Need deterministic issue-body validation.',
      '',
      '## Desired outcome',
      '',
      'Agent-authored issues validate against a versioned contract.',
      '',
      '## Scope',
      '',
      '### In scope',
      '- declarative contracts',
      '',
      '### Out of scope',
      '- executable plugins',
      '',
      '## Acceptance criteria',
      '',
      '- [ ] contracts load from .orfe/contracts',
      '',
      '## Docs impact',
      '',
      '- Docs impact: add new durable docs',
      '',
      '## ADR needed?',
      '',
      '- ADR needed: yes',
      '',
      renderIssueBodyContractMarker(),
    ].join('\n');

    const api = mockIssueUpdateRequest({
      issueNumber: 14,
      requestBody: {
        body: issueBody,
      },
    });

    const result = await runCoreCommand({
      command: 'issue update',
      input: {
        issue_number: 14,
        body: issueBody,
      },
    });

    assert.equal(result.ok, true);
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps issue update not-found responses clearly', async () => {
  await withNock(async () => {
    const api = mockIssueUpdateRequest({
      issueNumber: 999,
      requestBody: { title: 'Updated title' },
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue update',
        input: { issue_number: 999, title: 'Updated title' },
      }),
      /Issue #999 was not found\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps issue update auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockIssueUpdateRequest({
      issueNumber: 14,
      requestBody: { title: 'Updated title' },
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue update',
        input: { issue_number: 14, title: 'Updated title' },
      }),
      /GitHub App authentication failed while updating issue #14\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore rejects pull request targets for issue update clearly', async () => {
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

    await assert.rejects(
      runCoreCommand({
        command: 'issue update',
        input: { issue_number: 46, title: 'Updated title' },
      }),
      /Issue #46 is a pull request\. issue update only supports issues\./,
    );

    assert.equal(api.isDone(), false);
  });
});

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
