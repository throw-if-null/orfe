import assert from 'node:assert/strict';

import { test } from 'vitest';

import { COMMANDS } from '../index.js';
import { createHelpCommandSuccessData, createHelpRootSuccessData } from './definition.js';
import { runCoreCommand, runToolCommand } from '../../../test/support/command-runtime.js';
import { invokeCli } from '../../../test/support/cli-test.js';

test('runOrfeCore returns structured root help without caller context, config, auth, or GitHub access', async () => {
  const result = await runCoreCommand({
    command: 'help',
    input: {},
  });

  assert.deepEqual(result, {
    ok: true,
    command: 'help',
    data: createHelpRootSuccessData(COMMANDS),
  });
});

test('executeOrfeTool returns targeted command help through the shared success envelope', async () => {
  const result = await runToolCommand({
    input: {
      command: 'help',
      command_name: 'issue get',
    },
  });

  assert.deepEqual(result, {
    ok: true,
    command: 'help',
    data: createHelpCommandSuccessData(COMMANDS, 'issue get'),
  });
});

test('runOrfeCore returns representative targeted help across issue, pr, and project commands', async () => {
  for (const commandName of ['issue get', 'pr update', 'project set-status'] as const) {
    const result = await runCoreCommand({
      command: 'help',
      input: {
        command_name: commandName,
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'help',
      data: createHelpCommandSuccessData(COMMANDS, commandName),
    });
  }
});

test('runCli prints structured root help for the runtime help command without caller, config, auth, or GitHub access', async () => {
  const result = await invokeCli(['help'], {
    env: {},
    loadRepoConfigImpl: async () => {
      throw new Error('loadRepoConfigImpl should not run');
    },
    loadAuthConfigImpl: async () => {
      throw new Error('loadAuthConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    command: 'help',
    data: createHelpRootSuccessData(COMMANDS),
  });
});

test('runCli prints targeted structured help for the requested command', async () => {
  const result = await invokeCli(['help', '--command-name', 'issue get'], {
    env: {},
    loadRepoConfigImpl: async () => {
      throw new Error('loadRepoConfigImpl should not run');
    },
    loadAuthConfigImpl: async () => {
      throw new Error('loadAuthConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    command: 'help',
    data: createHelpCommandSuccessData(COMMANDS, 'issue get'),
  });
});

test('runCli prints representative targeted structured help for issue, pr, and project commands', async () => {
  for (const commandName of ['issue get', 'pr update', 'project set-status'] as const) {
    const result = await invokeCli(['help', '--command-name', commandName], {
      env: {},
      loadRepoConfigImpl: async () => {
        throw new Error('loadRepoConfigImpl should not run');
      },
      loadAuthConfigImpl: async () => {
        throw new Error('loadAuthConfigImpl should not run');
      },
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'help',
      data: createHelpCommandSuccessData(COMMANDS, commandName),
    });
  }
});

test('runCli reports help-command usage errors with the top-level help reference', async () => {
  const result = await invokeCli(['help', '--command-name']);

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Error: Missing value for option "--command-name"\./);
  assert.match(result.stderr, /Usage: orfe help \[--command-name <command>]$/m);
  assert.match(result.stderr, /See: orfe help --help/);
});
