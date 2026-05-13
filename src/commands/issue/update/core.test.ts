import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runCoreCommand } from '../../../../test/support/command-runtime.js';
import { mockIssueUpdateRequest } from '../../../../test/support/github/issue.js';
import { withNock } from '../../../../test/support/http-test.js';
import { renderIssueTemplateMarker } from '../../../../test/support/runtime-fixtures.js';

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
      'Agent-authored issues validate against a versioned template.',
      '',
      '## Scope',
      '',
      '### In scope',
      '- declarative templates',
      '',
      '### Out of scope',
      '- executable plugins',
      '',
      '## Acceptance criteria',
      '',
      '- [ ] templates load from .orfe/templates',
      '',
      '## Docs impact',
      '',
      '- Docs impact: add new durable docs',
      '',
      '## ADR needed?',
      '',
      '- ADR needed: yes',
      '',
      renderIssueTemplateMarker(),
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
