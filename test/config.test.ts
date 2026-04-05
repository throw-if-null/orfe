import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { getRoleAuthConfig, loadAuthConfig, loadRepoConfig, resolveCallerRole, resolveRepository } from '../src/config.js';

test('loadRepoConfig reads .orfe/config.json from the repo context', async () => {
  const repoDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-repo-config-'));
  await mkdir(path.join(repoDirectory, '.orfe'));
  await writeFile(
    path.join(repoDirectory, '.orfe', 'config.json'),
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

test('loadRepoConfig reports malformed repo config clearly', async () => {
  const repoDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-repo-config-'));
  await mkdir(path.join(repoDirectory, '.orfe'));
  await writeFile(path.join(repoDirectory, '.orfe', 'config.json'), '{bad json');

  await assert.rejects(loadRepoConfig({ cwd: repoDirectory }), /is not valid JSON/);
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

  await assert.rejects(loadAuthConfig({ authConfigPath }), /supports provider "github-app"/);
});

test('resolveCallerRole trims and matches exact caller names', async () => {
  const repoDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-repo-config-'));
  await mkdir(path.join(repoDirectory, '.orfe'));
  await writeFile(
    path.join(repoDirectory, '.orfe', 'config.json'),
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

test('resolveRepository uses repo override when provided', async () => {
  const repoDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-repo-config-'));
  await mkdir(path.join(repoDirectory, '.orfe'));
  await writeFile(
    path.join(repoDirectory, '.orfe', 'config.json'),
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
