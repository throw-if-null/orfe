import assert from 'node:assert/strict';
import { test } from 'vitest';

import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { mockIssueGetRequest } from '../mocks/github.js';

test('runOrfeCore reads an issue and returns structured success output', async () => {
  await withNock(async () => {
    const api = mockIssueGetRequest({ issueNumber: 14 });

    const result = await runCoreCommand({
      command: 'issue get',
      input: { issue_number: 14 },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue get',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        title: 'Build `orfe` foundation and runtime scaffolding',
        body: 'Issue body',
        state: 'open',
        state_reason: null,
        labels: ['needs-input'],
        assignees: ['greg'],
        html_url: 'https://github.com/throw-if-null/orfe/issues/14',
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('executeOrfeTool returns the shared success envelope for issue get', async () => {
  await withNock(async () => {
    const api = mockIssueGetRequest({ issueNumber: 14 });

    const result = await runToolCommand({
      input: {
        command: 'issue get',
        issue_number: 14,
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue get',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        title: 'Build `orfe` foundation and runtime scaffolding',
        body: 'Issue body',
        state: 'open',
        state_reason: null,
        labels: ['needs-input'],
        assignees: ['greg'],
        html_url: 'https://github.com/throw-if-null/orfe/issues/14',
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps issue get not-found responses clearly', async () => {
  await withNock(async () => {
    const api = mockIssueGetRequest({
      issueNumber: 999,
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue get',
        input: { issue_number: 999 },
      }),
      /Issue #999 was not found\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps issue get auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockIssueGetRequest({
      issueNumber: 14,
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue get',
        input: { issue_number: 14 },
      }),
      /GitHub App authentication failed while reading issue #14\./,
    );

    assert.equal(api.isDone(), true);
  });
});
