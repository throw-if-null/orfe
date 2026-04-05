import assert from 'node:assert/strict';
import test from 'node:test';

import { listCommandNames } from '../src/command-registry.js';
import { OrfeError } from '../src/errors.js';
import { createRuntimeSnapshot, runOrfeCore } from '../src/core.js';

function createRepoConfig() {
  return {
    configPath: '/tmp/.orfe/config.json',
    version: 1 as const,
    repository: {
      owner: 'throw-if-null',
      name: 'orfe',
      defaultBranch: 'main',
    },
    callerToGitHubRole: {
      Greg: 'greg',
    },
  };
}

function createAuthConfig() {
  return {
    configPath: '/tmp/auth.json',
    version: 1 as const,
    roles: {
      greg: {
        provider: 'github-app' as const,
        appId: 123458,
        appSlug: 'GR3G-BOT',
        privateKeyPath: '/tmp/greg.pem',
      },
    },
  };
}

test('listCommandNames exposes the agreed V1 command surface', () => {
  assert.deepEqual(listCommandNames(), [
    'issue.get',
    'issue.create',
    'issue.update',
    'issue.comment',
    'issue.set-state',
    'pr.get',
    'pr.get-or-create',
    'pr.comment',
    'pr.submit-review',
    'pr.reply',
    'project.get-status',
    'project.set-status',
  ]);
});

test('runOrfeCore returns the shared not-implemented stub error for leaf commands', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue.get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'not_implemented');
      assert.equal(error.message, 'Command "issue.get" is not implemented yet.');
      return true;
    },
  );
});

test('runOrfeCore rejects unmapped callers clearly', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Unknown Agent',
        command: 'issue.get',
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
      return true;
    },
  );
});

test('createRuntimeSnapshot validates machine-local auth mapping', async () => {
  await assert.rejects(
    createRuntimeSnapshot(
      {
        callerName: 'Greg',
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => ({
          configPath: '/tmp/auth.json',
          version: 1 as const,
          roles: {},
        }),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'auth_failed');
      return true;
    },
  );
});
