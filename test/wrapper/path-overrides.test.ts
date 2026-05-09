import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'vitest';

import type { OrfeCoreRequest, SuccessResponse } from '../../src/types.js';
import { executeOrfeTool } from '../../src/wrapper.js';
import { workspaceRoot } from '../support/runtime-fixtures.js';

test('executeOrfeTool forwards caller identity and common path overrides as plain core input', async () => {
  let capturedRequest: OrfeCoreRequest | undefined;
  let receivedAgentInCore = false;

  const result = await executeOrfeTool(
    {
      command: 'issue get',
      issue_number: 14,
      config: '/tmp/.orfe/config.json',
      auth_config: '/tmp/auth.json',
    },
    {
      agent: { name: 'Greg', role: 'implementation-owner' },
      cwd: '/tmp/repo',
    },
    {
      runOrfeCoreImpl: async (request) => {
        capturedRequest = request;
        receivedAgentInCore = 'agent' in (request as unknown as Record<string, unknown>);

        return {
          ok: true,
          command: 'issue get',
          repo: 'throw-if-null/orfe',
          data: { issue_number: 14 },
        } satisfies SuccessResponse<Record<string, unknown>>;
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    command: 'issue get',
    repo: 'throw-if-null/orfe',
    data: { issue_number: 14 },
  });
  assert.deepEqual(capturedRequest, {
    callerName: 'Greg',
    command: 'issue get',
    input: { issue_number: 14 },
    entrypoint: 'opencode-plugin',
    configPath: '/tmp/.orfe/config.json',
    authConfigPath: '/tmp/auth.json',
    cwd: '/tmp/repo',
    logger: capturedRequest?.logger,
  });
  assert.equal(typeof capturedRequest?.logger?.error, 'function');
  assert.equal(capturedRequest?.logger?.level, 'error');
  assert.equal(receivedAgentInCore, false);
});

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

test('executeOrfeTool returns structured config failures for issue validate when config path is invalid', async () => {
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
