import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../src/runtime/errors.js';
import { runOrfeCore } from '../../src/core/run.js';
import { createAuthConfig, createRepoConfig } from '../support/runtime-fixtures.js';

test('runOrfeCore rejects unmapped callers clearly for GitHub-backed commands', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Unknown Agent',
        command: 'issue get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'caller_name_unmapped');
      assert.match(error.message, /Caller name "Unknown Agent" is not mapped/);
      return true;
    },
  );
});

test('runOrfeCore surfaces auth config loading failures clearly for GitHub-backed commands', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => {
          throw new OrfeError('config_not_found', 'machine-local auth config not found at /tmp/auth.json.');
        },
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'config_not_found');
      assert.equal(error.message, 'machine-local auth config not found at /tmp/auth.json.');
      return true;
    },
  );
});

test('runOrfeCore forwards explicit auth config paths into shared auth config loading', async () => {
  let capturedOptions: Record<string, string> | undefined;

  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue get',
        input: { issue_number: 14 },
        cwd: '/tmp/repo',
        authConfigPath: '/tmp/custom-auth.json',
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async (options = {}) => {
          capturedOptions = {
            ...(options.cwd ? { cwd: options.cwd } : {}),
            ...(options.authConfigPath ? { authConfigPath: options.authConfigPath } : {}),
          };

          throw new OrfeError('config_not_found', 'machine-local auth config not found at /tmp/custom-auth.json.');
        },
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'config_not_found');
      assert.equal(error.message, 'machine-local auth config not found at /tmp/custom-auth.json.');
      return true;
    },
  );

  assert.deepEqual(capturedOptions, {
    cwd: '/tmp/repo',
    authConfigPath: '/tmp/custom-auth.json',
  });
});

test('runOrfeCore rejects empty caller names clearly', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: '   ',
        command: 'issue get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'caller_name_missing');
      return true;
    },
  );
});

test('runOrfeCore rejects repo-local config failures before auth config loading succeeds', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => {
          throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
        },
        loadAuthConfigImpl: async () => {
          throw new OrfeError('internal_error', 'auth config should not load');
        },
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'config_not_found');
      return true;
    },
  );
});
