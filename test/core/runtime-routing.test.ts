import assert from 'node:assert/strict';
import { test } from 'vitest';

import { COMMANDS } from '../../src/commands/index.js';
import { createHelpCommandSuccessData, createHelpRootSuccessData } from '../../src/commands/help/definition.js';
import { runOrfeCore } from '../../src/core.js';

test('runOrfeCore returns runtime info without caller, config, auth, or GitHub access', async () => {
  const result = await runOrfeCore(
    {
      callerName: '',
      command: 'runtime info',
      input: {},
      entrypoint: 'cli',
    },
    {
      loadRepoConfigImpl: async () => {
        throw new Error('loadRepoConfigImpl should not run');
      },
      loadAuthConfigImpl: async () => {
        throw new Error('loadAuthConfigImpl should not run');
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.command, 'runtime info');
  assert.equal(result.repo, undefined);
  const data = result.data as { orfe_version: string; entrypoint: string };
  assert.match(data.orfe_version, /^\d+\.\d+\.\d+/);
  assert.deepEqual(data, {
    orfe_version: data.orfe_version,
    entrypoint: 'cli',
  });
});

test('runOrfeCore returns root help without caller, config, auth, or GitHub access', async () => {
  const result = await runOrfeCore(
    {
      callerName: '',
      command: 'help',
      input: {},
      entrypoint: 'opencode-plugin',
    },
    {
      loadRepoConfigImpl: async () => {
        throw new Error('loadRepoConfigImpl should not run');
      },
      loadAuthConfigImpl: async () => {
        throw new Error('loadAuthConfigImpl should not run');
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.command, 'help');
  assert.equal(result.repo, undefined);
  assert.deepEqual(result.data, createHelpRootSuccessData(COMMANDS));
});

test('runOrfeCore returns targeted command help without caller, config, auth, or GitHub access', async () => {
  const result = await runOrfeCore(
    {
      callerName: '',
      command: 'help',
      input: { command_name: 'runtime info' },
      entrypoint: 'opencode-plugin',
    },
    {
      loadRepoConfigImpl: async () => {
        throw new Error('loadRepoConfigImpl should not run');
      },
      loadAuthConfigImpl: async () => {
        throw new Error('loadAuthConfigImpl should not run');
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.command, 'help');
  assert.equal(result.repo, undefined);
  assert.deepEqual(result.data, createHelpCommandSuccessData(COMMANDS, 'runtime info'));
});

test('runOrfeCore returns targeted command help with explicit requirements for representative commands', async () => {
  for (const commandName of ['issue get', 'pr get-or-create', 'project set-status'] as const) {
    const result = await runOrfeCore(
      {
        callerName: '',
        command: 'help',
        input: { command_name: commandName },
        entrypoint: 'opencode-plugin',
      },
      {
        loadRepoConfigImpl: async () => {
          throw new Error('loadRepoConfigImpl should not run');
        },
        loadAuthConfigImpl: async () => {
          throw new Error('loadAuthConfigImpl should not run');
        },
      },
    );

    assert.equal(result.ok, true);
    assert.equal(result.command, 'help');
    assert.deepEqual(result.data, createHelpCommandSuccessData(COMMANDS, commandName));
  }
});
