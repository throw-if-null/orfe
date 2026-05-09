import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { mockAuthTokenMintRequest } from './mocks/github.js';
import { withNock } from '../../../../test/support/http-test.js';

test('runOrfeCore mints an auth token for the resolved caller bot', async () => {
  await withNock(async () => {
    const api = mockAuthTokenMintRequest({ repo: { owner: 'throw-if-null', name: 'orfe' } });

    const result = await runCoreCommand({
      command: 'auth token',
      input: { repo: 'throw-if-null/orfe' },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'auth token',
      repo: 'throw-if-null/orfe',
      data: {
        bot: 'greg',
        app_slug: 'GR3G-BOT',
        repo: 'throw-if-null/orfe',
        token: 'ghs_123',
        expires_at: '2026-04-06T12:00:00Z',
        auth_mode: 'github-app',
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('executeOrfeTool resolves auth token from context.agent and returns shared success envelope', async () => {
  await withNock(async () => {
    const api = mockAuthTokenMintRequest();

    const result = await runToolCommand({
      input: {
        command: 'auth token',
        repo: 'throw-if-null/orfe',
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'auth token',
      repo: 'throw-if-null/orfe',
      data: {
        bot: 'greg',
        app_slug: 'GR3G-BOT',
        repo: 'throw-if-null/orfe',
        token: 'ghs_123',
        expires_at: '2026-04-06T12:00:00Z',
        auth_mode: 'github-app',
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore rejects bot override input for auth token', async () => {
  await assert.rejects(
    runCoreCommand({
      command: 'auth token',
      input: { bot: 'unknown', repo: 'throw-if-null/orfe' },
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'invalid_usage');
      assert.equal(error.message, 'Command "auth token" does not accept input field "bot".');
      return true;
    },
  );
});

test('executeOrfeTool rejects bot override input for auth token', async () => {
  const result = await runToolCommand({
    input: {
      command: 'auth token',
      bot: 'greg',
      repo: 'throw-if-null/orfe',
    },
  });

  assert.deepEqual(result, {
    ok: false,
    command: 'auth token',
    error: {
      code: 'invalid_usage',
      message: 'Command "auth token" does not accept input field "bot".',
      retryable: false,
    },
  });
});
