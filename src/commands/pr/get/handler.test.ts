import assert from 'node:assert/strict';
import { test } from 'vitest';

import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { mockPullRequestGetRequest } from '../../../../test/pr/fixtures.js';

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
