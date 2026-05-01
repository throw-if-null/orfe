import assert from 'node:assert/strict';
import { test } from 'vitest';

import OrfePlugin, { OrfePlugin as NamedOrfePlugin } from '../src/plugin.js';
import { executeOrfeTool } from '../src/wrapper.js';

test('plugin entry points export a plugin function', () => {
  assert.equal(typeof OrfePlugin, 'function');
  assert.equal(typeof NamedOrfePlugin, 'function');
});

test('plugin contract can retrieve runtime info for the active plugin runtime', async () => {
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
    assert.equal((result.data as { entrypoint: string }).entrypoint, 'opencode-plugin');
  }
});

test('plugin contract can retrieve structured help without caller context', async () => {
  const result = await executeOrfeTool(
    {
      command: 'help',
      command_name: 'project set-status',
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
    assert.equal((result.data as { canonical_command_name: string }).canonical_command_name, 'project set-status');
    assert.deepEqual((result.data as { requirements: Record<string, string> }).requirements, {
      caller_context: 'required',
      repo_local_config: 'required',
      machine_local_auth_config: 'required',
      github_access: 'required',
    });
  }
});
