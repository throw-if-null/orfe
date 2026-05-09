import assert from 'node:assert/strict';
import { test } from 'vitest';

import { executeOrfeTool, resolveCallerNameFromContext } from '../../src/wrapper.js';

test('resolveCallerNameFromContext accepts a string agent name', () => {
  assert.equal(resolveCallerNameFromContext({ agent: 'Greg' }), 'Greg');
});

test('resolveCallerNameFromContext accepts context.agent.name', () => {
  assert.equal(resolveCallerNameFromContext({ agent: { name: 'Jelena' } }), 'Jelena');
});

test('executeOrfeTool rejects missing caller context clearly', async () => {
  const result = await executeOrfeTool(
    {
      command: 'issue get',
      issue_number: 14,
    },
    {},
  );

  assert.deepEqual(result, {
    ok: false,
    command: 'issue get',
    error: {
      code: 'caller_context_missing',
      message: 'OpenCode caller context is missing.',
      retryable: false,
    },
  });
});

test('executeOrfeTool rejects caller_name from tool input', async () => {
  const result = await executeOrfeTool(
    {
      command: 'issue get',
      caller_name: 'Greg',
      issue_number: 14,
    },
    {
      agent: 'Greg',
    },
  );

  assert.deepEqual(result, {
    ok: false,
    command: 'issue get',
    error: {
      code: 'invalid_usage',
      message: 'Tool input does not accept caller_name; caller identity comes from context.agent.',
      retryable: false,
    },
  });
});
