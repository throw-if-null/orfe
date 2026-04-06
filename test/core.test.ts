import assert from 'node:assert/strict';
import test from 'node:test';

import { getCommandContract } from '../src/command-contracts.js';
import { getCommandDefinition, listCommandNames } from '../src/command-registry.js';
import { OrfeError } from '../src/errors.js';
import { createRuntimeSnapshot, runOrfeCore } from '../src/core.js';
import type { OrfeCommandName } from '../src/types.js';

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

const EXPECTED_COMMANDS: readonly OrfeCommandName[] = [
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
];

test('listCommandNames exposes the agreed V1 command surface', () => {
  assert.deepEqual(listCommandNames(), EXPECTED_COMMANDS);
});

test('every command exposes a non-breaking placeholder contract and success example', () => {
  for (const commandName of EXPECTED_COMMANDS) {
    const definition = getCommandDefinition(commandName);
    const contract = getCommandContract(commandName);

    assert.deepEqual(definition.successDataExample, contract.successDataExample);
    assert.ok(contract.validInput);
  }
});

test('runOrfeCore can be exercised directly with plain callerName data', async () => {
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

test('runOrfeCore returns the shared not-implemented stub error for every leaf command', async (t) => {
  await Promise.all(
    EXPECTED_COMMANDS.map((commandName) =>
      t.test(commandName, async () => {
        const contract = getCommandContract(commandName);

        await assert.rejects(
          runOrfeCore(
            {
              callerName: 'Greg',
              command: commandName,
              input: contract.validInput,
            },
            {
              loadRepoConfigImpl: async () => createRepoConfig(),
              loadAuthConfigImpl: async () => createAuthConfig(),
            },
          ),
          (error: unknown) => {
            assert(error instanceof OrfeError);
            assert.equal(error.code, 'not_implemented');
            assert.equal(error.message, `Command "${commandName}" is not implemented yet.`);
            return true;
          },
        );
      }),
    ),
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
      assert.match(error.message, /Caller name "Unknown Agent" is not mapped/);
      return true;
    },
  );
});

test('runOrfeCore rejects empty caller names clearly', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: '   ',
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
        command: 'issue.get',
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

test('createRuntimeSnapshot proves auth config is separate from repo-local config', async () => {
  const snapshot = await createRuntimeSnapshot(
    {
      callerName: 'Greg',
    },
    {
      loadRepoConfigImpl: async () => createRepoConfig(),
      loadAuthConfigImpl: async () => createAuthConfig(),
    },
  );

  assert.equal(snapshot.repoConfig.configPath, '/tmp/.orfe/config.json');
  assert.equal(snapshot.authConfig.configPath, '/tmp/auth.json');
  assert.equal(snapshot.callerRole, 'greg');
});
