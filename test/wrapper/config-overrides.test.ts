import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'vitest';

import { executeOrfeTool } from '../../src/wrapper.js';
import { workspaceRoot } from '../support/runtime-fixtures.js';

test('executeOrfeTool returns structured config failures when forwarded config path is invalid', async () => {
  const missingConfigPath = path.join(workspaceRoot, 'missing-issue-validate-config.json');

  const result = await executeOrfeTool(
    {
      command: 'issue validate',
      body: [
        '## Problem / context',
        '',
        'Need deterministic issue-body validation.',
        '',
        '## Desired outcome',
        '',
        'Issue bodies validate against a versioned contract.',
      ].join('\n'),
      body_contract: 'formal-work-item@1.0.0',
      config: missingConfigPath,
    },
    {
      agent: 'Greg',
      cwd: workspaceRoot,
    },
  );

  assert.deepEqual(result, {
    ok: false,
    command: 'issue validate',
    error: {
      code: 'config_not_found',
      message: `repo-local config not found at ${missingConfigPath}.`,
      retryable: false,
    },
  });
});
