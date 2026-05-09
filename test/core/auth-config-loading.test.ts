import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../src/errors.js';
import { runOrfeCore } from '../../src/core.js';
import { mockAuthTokenMintRequest } from '../support/auth-fixtures.js';
import { withNock } from '../support/http-test.js';
import { createAuthConfig, createRepoConfig } from '../support/runtime-fixtures.js';

test('runOrfeCore mints an auth token for the resolved caller bot', async () => {
  await withNock(async () => {
    const api = mockAuthTokenMintRequest({ repo: { owner: 'throw-if-null', name: 'orfe' } });

    const { createGitHubClientFactory } = await import('../support/runtime-fixtures.js');
    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'auth token',
        input: {
          repo: 'throw-if-null/orfe',
        },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'auth token',
      repo: 'throw-if-null/orfe',
      data: {
        bot: 'greg',
        app_slug: 'GR3G-BOT',
        repo: 'throw-if-null/orfe',
        token: 'ghs_123',
        expires_at: '2026-04-06T12:00:00Z',
        auth_mode: 'github-app',
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore rejects bot override input for auth token', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'auth token',
        input: { bot: 'unknown', repo: 'throw-if-null/orfe' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'invalid_usage');
      assert.equal(error.message, 'Command "auth token" does not accept input field "bot".');
      return true;
    },
  );
});

test('runOrfeCore fails clearly for auth token when the caller is unmapped', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Unknown Agent',
        command: 'auth token',
        input: { repo: 'throw-if-null/orfe' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'caller_name_unmapped');
      assert.match(error.message, /Caller name "Unknown Agent" is not mapped/);
      return true;
    },
  );
});

test('runOrfeCore fails clearly for auth token when the installation is missing', async () => {
  await withNock(async () => {
    const api = mockAuthTokenMintRequest({ installationStatus: 404 });
    const { createGitHubClientFactory } = await import('../support/runtime-fixtures.js');

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'auth token',
          input: { repo: 'throw-if-null/orfe' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'No GitHub App installation for throw-if-null/orfe was found for app GR3G-BOT.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore fails clearly for auth token when token minting is rejected', async () => {
  await withNock(async () => {
    const api = mockAuthTokenMintRequest({ tokenStatus: 403 });
    const { createGitHubClientFactory } = await import('../support/runtime-fixtures.js');

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'auth token',
          input: { repo: 'throw-if-null/orfe' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'Failed to mint an installation token for bot "greg" on throw-if-null/orfe.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore surfaces config failures for auth token clearly', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'auth token',
        input: { repo: 'throw-if-null/orfe' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => {
          throw new OrfeError('config_not_found', 'machine-local auth config not found at /tmp/auth.json.');
        },
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'config_not_found');
      assert.equal(error.message, 'machine-local auth config not found at /tmp/auth.json.');
      return true;
    },
  );
});

test('runOrfeCore rejects unmapped callers clearly', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Unknown Agent',
        command: 'issue get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'caller_name_unmapped');
      assert.match(error.message, /Caller name "Unknown Agent" is not mapped/);
      return true;
    },
  );
});

test('runOrfeCore rejects empty caller names clearly', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: '   ',
        command: 'issue get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'caller_name_missing');
      return true;
    },
  );
});

test('runOrfeCore rejects repo-local config failures before auth config loading succeeds', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => {
          throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
        },
        loadAuthConfigImpl: async () => {
          throw new OrfeError('internal_error', 'auth config should not load');
        },
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'config_not_found');
      return true;
    },
  );
});
