import assert from 'node:assert/strict';
import { test } from 'vitest';

import OrfePlugin from '../src/plugin.js';
import { executeOrfeTool } from '../src/wrapper.js';

test('plugin exposes common path override inputs on the orfe tool', async () => {
  const plugin = await OrfePlugin({} as never);
  const orfeTool = plugin.tool?.orfe;

  assert.ok(orfeTool);
  assert.equal('config' in orfeTool.args, true);
  assert.equal('auth_config' in orfeTool.args, true);
  assert.equal('title' in orfeTool.args, true);
  assert.equal('body' in orfeTool.args, true);
  assert.equal('template' in orfeTool.args, true);
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
    const help = result.data as {
      canonical_command_name: string;
      requirements: Record<string, string>;
      supported_input_fields: Array<{ input_key: string }>;
    };

    assert.equal(result.command, 'help');
    assert.equal(help.canonical_command_name, 'project set-status');
    assert.deepEqual(help.requirements, {
      caller_context: 'required',
      repo_local_config: 'required',
      machine_local_auth_config: 'required',
      github_access: 'required',
    });
    assert.equal(help.supported_input_fields.some((field) => field.input_key === 'config'), true);
    assert.equal(help.supported_input_fields.some((field) => field.input_key === 'auth_config'), true);
  }
});
