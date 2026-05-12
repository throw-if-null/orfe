import assert from 'node:assert/strict';
import { test } from 'vitest';

import { COMMANDS } from '../../src/commands/index.js';
import { createHelpCommandSuccessData, createHelpRootSuccessData } from '../../src/commands/help/definition.js';
import { executeOrfeTool } from '../../src/opencode/tool.js';

test('executeOrfeTool returns runtime info through the shared success envelope without caller context', async () => {
  const result = await executeOrfeTool(
    {
      command: 'runtime info',
    },
    {},
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
  if (result.ok) {
    assert.equal(result.command, 'runtime info');
    assert.equal(result.repo, undefined);
    assert.match(String((result.data as { orfe_version: string }).orfe_version), /^\d+\.\d+\.\d+/);
    assert.deepEqual(result.data, {
      orfe_version: (result.data as { orfe_version: string }).orfe_version,
      entrypoint: 'opencode-plugin',
    });
  }
});

test('executeOrfeTool returns root help through the shared success envelope without caller context', async () => {
  const result = await executeOrfeTool(
    {
      command: 'help',
    },
    {},
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
  if (result.ok) {
    assert.equal(result.command, 'help');
    assert.equal(result.repo, undefined);
    assert.deepEqual(result.data, createHelpRootSuccessData(COMMANDS));
  }
});

test('executeOrfeTool returns targeted command help through the shared success envelope without caller context', async () => {
  const result = await executeOrfeTool(
    {
      command: 'help',
      command_name: 'issue get',
    },
    {},
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
  if (result.ok) {
    assert.equal(result.command, 'help');
    assert.equal(result.repo, undefined);
    assert.deepEqual(result.data, createHelpCommandSuccessData(COMMANDS, 'issue get'));
  }
});

test('executeOrfeTool returns representative targeted help across issue, pr, and project commands', async () => {
  for (const commandName of ['issue get', 'pr update', 'project set-status'] as const) {
    const result = await executeOrfeTool(
      {
        command: 'help',
        command_name: commandName,
      },
      {},
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
    if (result.ok) {
      assert.deepEqual(result.data, createHelpCommandSuccessData(COMMANDS, commandName));
    }
  }
});
