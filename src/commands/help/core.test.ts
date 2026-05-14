import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runCoreCommand } from '../../../test/support/command-runtime.js';
import { COMMANDS } from '../index.js';
import { createHelpCommandSuccessData, createHelpRootSuccessData } from './definition.js';

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

test('runOrfeCore returns targeted help for a requested command through the runtime boundary', async () => {
  const result = await runCoreCommand({
    command: 'help',
    input: {
      command_name: 'issue get',
    },
  });

  assert.deepEqual(result, {
    ok: true,
    command: 'help',
    data: createHelpCommandSuccessData(COMMANDS, 'issue get'),
  });
});
