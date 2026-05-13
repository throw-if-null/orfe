import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../test/support/command-runtime.js';
import { COMMANDS } from '../index.js';
import { createHelpCommandSuccessData } from './definition.js';

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
