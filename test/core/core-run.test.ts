import assert from 'node:assert/strict';
import { test } from 'vitest';

import { runOrfeCore } from '../../src/core/run.js';
import { OrfeError } from '../../src/runtime/errors.js';
import { readPackageVersion } from '../support/cli-test.js';

test('runOrfeCore executes runtime-only commands without caller, config, auth, or GitHub access', async () => {
  const packageVersion = await readPackageVersion();

  const result = await runOrfeCore(
    {
      callerName: '',
      command: 'runtime info',
      input: {},
    },
    {
      loadRepoConfigImpl: async () => {
        throw new Error('loadRepoConfigImpl should not run');
      },
      loadAuthConfigImpl: async () => {
        throw new Error('loadAuthConfigImpl should not run');
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    command: 'runtime info',
    data: {
      orfe_version: packageVersion,
      entrypoint: 'cli',
    },
  });
});

test('runOrfeCore rejects unknown commands before loading config or auth', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue unknown',
        input: {},
      },
      {
        loadRepoConfigImpl: async () => {
          throw new Error('loadRepoConfigImpl should not run');
        },
        loadAuthConfigImpl: async () => {
          throw new Error('loadAuthConfigImpl should not run');
        },
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'invalid_usage');
      assert.match(error.message, /Unknown command "issue unknown"\./);
      return true;
    },
  );
});
