import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { OrfeError } from '../src/errors.js';
import { getRoleAuthConfig, loadAuthConfig, loadRepoConfig, resolveCallerRole, resolveRepository } from '../src/config.js';

async function writeRepoConfig(repoDirectory: string, content: string): Promise<void> {
  await mkdir(path.join(repoDirectory, '.orfe'), { recursive: true });
  await writeFile(path.join(repoDirectory, '.orfe', 'config.json'), content);
}

test('loadRepoConfig reads .orfe/config.json from the repo context', async () => {
  const repoDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-repo-config-'));
  await writeRepoConfig(
    repoDirectory,
    JSON.stringify({
      version: 1,
      repository: {
        owner: 'throw-if-null',
        name: 'orfe',
        default_branch: 'main',
      },
      caller_to_github_role: {
        Greg: 'greg',
      },
      projects: {
        default: {
          owner: 'throw-if-null',
          project_number: 1,
          status_field_name: 'Status',
        },
      },
    }),
  );

  const config = await loadRepoConfig({ cwd: path.join(repoDirectory, 'nested', 'child') });

  assert.equal(config.repository.owner, 'throw-if-null');
  assert.equal(config.repository.defaultBranch, 'main');
  assert.equal(config.projects?.default?.projectNumber, 1);
});

test('loadRepoConfig reports missing repo-local config clearly', async () => {
  const repoDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-repo-config-'));

  await assert.rejects(loadRepoConfig({ cwd: repoDirectory }), (error: unknown) => {
    assert(error instanceof OrfeError);
    assert.equal(error.code, 'config_not_found');
    assert.match(error.message, /repo-local config not found/);
    return true;
  });
});

test('loadRepoConfig reports malformed repo config clearly', async () => {
  const repoDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-repo-config-'));
  await writeRepoConfig(repoDirectory, '{bad json');

  await assert.rejects(loadRepoConfig({ cwd: repoDirectory }), (error: unknown) => {
    assert(error instanceof OrfeError);
    assert.equal(error.code, 'config_invalid');
    assert.match(error.message, /is not valid JSON/);
    return true;
  });
});

test('loadRepoConfig reports missing required repo-local fields clearly', async () => {
  const repoDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-repo-config-'));
  await writeRepoConfig(
    repoDirectory,
    JSON.stringify({
      version: 1,
      repository: {
        owner: 'throw-if-null',
        name: 'orfe',
      },
      caller_to_github_role: {
        Greg: 'greg',
      },
    }),
  );

  await assert.rejects(loadRepoConfig({ cwd: repoDirectory }), (error: unknown) => {
    assert(error instanceof OrfeError);
    assert.equal(error.code, 'config_invalid');
    assert.match(error.message, /repository\.default_branch must be a non-empty string/);
    return true;
  });
});

test('loadAuthConfig reads machine-local GitHub App credentials', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-auth-config-'));
  const authConfigPath = path.join(tempDirectory, 'auth.json');

  await writeFile(
    authConfigPath,
    JSON.stringify({
      version: 1,
      roles: {
        greg: {
          provider: 'github-app',
          app_id: 123458,
          app_slug: 'GR3G-BOT',
          private_key_path: '~/keys/greg.pem',
        },
      },
    }),
  );

  const config = await loadAuthConfig({ authConfigPath, homeDirectory: '/home/test-user' });
  const roleConfig = getRoleAuthConfig(config, 'greg');

  assert.equal(roleConfig.provider, 'github-app');
  assert.equal(roleConfig.appId, 123458);
  assert.equal(roleConfig.privateKeyPath, '/home/test-user/keys/greg.pem');
});

test('loadAuthConfig does not require an external token_command contract', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-auth-config-'));
  const authConfigPath = path.join(tempDirectory, 'auth.json');

  await writeFile(
    authConfigPath,
    JSON.stringify({
      version: 1,
      roles: {
        greg: {
          provider: 'github-app',
          app_id: 123458,
          app_slug: 'GR3G-BOT',
          private_key_path: '/tmp/greg.pem',
        },
      },
    }),
  );

  const config = await loadAuthConfig({ authConfigPath });

  assert.equal(config.roles.greg?.provider, 'github-app');
});

test('loadAuthConfig reports missing machine-local auth config clearly', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-auth-config-'));
  const authConfigPath = path.join(tempDirectory, 'missing-auth.json');

  await assert.rejects(loadAuthConfig({ authConfigPath }), (error: unknown) => {
    assert(error instanceof OrfeError);
    assert.equal(error.code, 'config_not_found');
    assert.match(error.message, /machine-local auth config not found/);
    return true;
  });
});

test('loadAuthConfig reports malformed machine-local auth config clearly', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-auth-config-'));
  const authConfigPath = path.join(tempDirectory, 'auth.json');
  await writeFile(authConfigPath, '{bad json');

  await assert.rejects(loadAuthConfig({ authConfigPath }), (error: unknown) => {
    assert(error instanceof OrfeError);
    assert.equal(error.code, 'config_invalid');
    assert.match(error.message, /is not valid JSON/);
    return true;
  });
});

test('loadAuthConfig rejects unsupported providers', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-auth-config-'));
  const authConfigPath = path.join(tempDirectory, 'auth.json');

  await writeFile(
    authConfigPath,
    JSON.stringify({
      version: 1,
      roles: {
        greg: {
          provider: 'session',
          app_id: 1,
          app_slug: 'GR3G-BOT',
          private_key_path: '/tmp/greg.pem',
        },
      },
    }),
  );

  await assert.rejects(loadAuthConfig({ authConfigPath }), (error: unknown) => {
    assert(error instanceof OrfeError);
    assert.equal(error.code, 'config_invalid');
    assert.match(error.message, /only supports provider "github-app" in v1/);
    return true;
  });
});

test('loadAuthConfig rejects missing required auth fields clearly', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-auth-config-'));
  const authConfigPath = path.join(tempDirectory, 'auth.json');

  await writeFile(
    authConfigPath,
    JSON.stringify({
      version: 1,
      roles: {
        greg: {
          provider: 'github-app',
          app_slug: 'GR3G-BOT',
          private_key_path: '/tmp/greg.pem',
        },
      },
    }),
  );

  await assert.rejects(loadAuthConfig({ authConfigPath }), (error: unknown) => {
    assert(error instanceof OrfeError);
    assert.equal(error.code, 'config_invalid');
    assert.match(error.message, /roles\.greg\.app_id must be a non-negative integer/);
    return true;
  });
});

test('resolveCallerRole trims and matches exact caller names', async () => {
  const repoDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-repo-config-'));
  await writeRepoConfig(
    repoDirectory,
    JSON.stringify({
      version: 1,
      repository: {
        owner: 'throw-if-null',
        name: 'orfe',
        default_branch: 'main',
      },
      caller_to_github_role: {
        Greg: 'greg',
      },
    }),
  );

  const config = await loadRepoConfig({ cwd: repoDirectory });

  assert.equal(resolveCallerRole(config, ' Greg '), 'greg');
  assert.throws(() => resolveCallerRole(config, 'greg'), /not mapped/);
});

test('getRoleAuthConfig reports missing caller-name to GitHub-role mappings where required', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-auth-config-'));
  const authConfigPath = path.join(tempDirectory, 'auth.json');
  await writeFile(authConfigPath, JSON.stringify({ version: 1, roles: {} }));

  const config = await loadAuthConfig({ authConfigPath });

  assert.throws(() => getRoleAuthConfig(config, 'greg'), /has no entry for GitHub role "greg"/);
});

test('resolveRepository uses repo override when provided', async () => {
  const repoDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-repo-config-'));
  await writeRepoConfig(
    repoDirectory,
    JSON.stringify({
      version: 1,
      repository: {
        owner: 'throw-if-null',
        name: 'orfe',
        default_branch: 'main',
      },
      caller_to_github_role: {
        Greg: 'greg',
      },
    }),
  );

  const config = await loadRepoConfig({ cwd: repoDirectory });
  const repository = resolveRepository(config, 'octo/demo');

  assert.equal(repository.fullName, 'octo/demo');
});
