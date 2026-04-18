import assert from 'node:assert/strict';
import test from 'node:test';

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
