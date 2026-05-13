import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli, repoConfigPath } from '../../../../test/support/cli-test.js';
import { mockAuthTokenMintRequest } from '../../../../test/support/github/auth.js';
import { withNock } from '../../../../test/support/http-test.js';

test('runCli requires caller identity and mints auth token for that caller bot', async () => {
  await withNock(async () => {
    const api = mockAuthTokenMintRequest({});

    const result = await invokeCli(['auth', 'token', '--repo', 'throw-if-null/orfe'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
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

test('runCli rejects bot override for auth token as invalid usage', async () => {
  const result = await invokeCli(['auth', 'token', '--repo', 'throw-if-null/orfe', '--bot', 'greg'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Unknown option "--bot"\./);
  assert.match(result.stderr, /See: orfe auth token --help/);
});

test('runCli prints structured auth failure for auth token missing installation', async () => {
  await withNock(async () => {
    const api = mockAuthTokenMintRequest({ installationStatus: 404 });

    const result = await invokeCli(['auth', 'token', '--repo', 'throw-if-null/orfe'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'auth token',
      error: {
        code: 'auth_failed',
        message: 'No GitHub App installation for throw-if-null/orfe was found for app GR3G-BOT.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured config failures for auth token', async () => {
  const result = await invokeCli(['auth', 'token', '--repo', 'throw-if-null/orfe'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => ({
      configPath: repoConfigPath,
      version: 1 as const,
      repository: { owner: 'throw-if-null', name: 'orfe', defaultBranch: 'main' },
      callerToBot: { Greg: 'greg' },
    }),
    loadAuthConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'machine-local auth config not found at /tmp/auth.json.');
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: 'auth token',
    error: {
      code: 'config_not_found',
      message: 'machine-local auth config not found at /tmp/auth.json.',
      retryable: false,
    },
  });
});

test('runCli reports missing required options for auth token as usage errors', async () => {
  const result = await invokeCli(['auth', 'token'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Missing required option "--repo"\./);
  assert.match(result.stderr, /Usage: orfe auth token --repo <owner\/name>/);
  assert.match(result.stderr, /See: orfe auth token --help/);
});

test('runCli reports missing caller identity for auth token', async () => {
  const result = await invokeCli(['auth', 'token', '--repo', 'throw-if-null/orfe'], {
    env: {},
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /CLI caller identity is required via ORFE_CALLER_NAME\./);
  assert.match(result.stderr, /See: orfe auth token --help/);
});

test('runCli rejects removed --caller-name override for auth token', async () => {
  const result = await invokeCli(['auth', 'token', '--repo', 'throw-if-null/orfe', '--caller-name', 'Jelena'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Unknown option "--caller-name"\./);
  assert.match(result.stderr, /See: orfe auth token --help/);
});
