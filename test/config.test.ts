import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';

import { OrfeError } from '../src/errors.js';
import {
  getBotAuthConfig,
  loadAuthConfig,
  loadRepoConfig,
  resolveCallerBot,
  resolveProjectCommandConfig,
  resolveRepository,
} from '../src/config.js';

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
      caller_to_bot: {
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

test('loadRepoConfig ignores template files because they live outside .orfe/config.json', async () => {
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
      caller_to_bot: {
        Greg: 'greg',
      },
    }),
  );

  await mkdir(path.join(repoDirectory, '.orfe', 'templates', 'issues', 'formal-work-item'), { recursive: true });
  await writeFile(
    path.join(repoDirectory, '.orfe', 'templates', 'issues', 'formal-work-item', '1.0.0.json'),
    JSON.stringify({
      schema_version: 1,
      artifact_type: 'issue',
      template_name: 'formal-work-item',
      template_version: '1.0.0',
      sections: [],
    }),
  );

  const config = await loadRepoConfig({ cwd: repoDirectory });

  assert.equal('bodyContracts' in config, false);
  assert.equal(config.repository.name, 'orfe');
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
      caller_to_bot: {
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
      bots: {
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
  const botConfig = getBotAuthConfig(config, 'greg');

  assert.equal(botConfig.provider, 'github-app');
  assert.equal(botConfig.appId, 123458);
  assert.equal(botConfig.privateKeyPath, '/home/test-user/keys/greg.pem');
});

test('loadAuthConfig does not require an external token_command contract', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-auth-config-'));
  const authConfigPath = path.join(tempDirectory, 'auth.json');

  await writeFile(
    authConfigPath,
    JSON.stringify({
      version: 1,
      bots: {
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

  assert.equal(config.bots.greg?.provider, 'github-app');
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
      bots: {
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
      bots: {
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
    assert.match(error.message, /bots\.greg\.app_id must be a non-negative integer/);
    return true;
  });
});

test('resolveCallerBot trims and matches exact caller names', async () => {
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
      caller_to_bot: {
        Greg: 'greg',
      },
    }),
  );

  const config = await loadRepoConfig({ cwd: repoDirectory });

  assert.equal(resolveCallerBot(config, ' Greg '), 'greg');
  assert.throws(() => resolveCallerBot(config, 'greg'), /not mapped/);
});

test('getBotAuthConfig reports missing caller-name to bot mappings where required', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-auth-config-'));
  const authConfigPath = path.join(tempDirectory, 'auth.json');
  await writeFile(authConfigPath, JSON.stringify({ version: 1, bots: {} }));

  const config = await loadAuthConfig({ authConfigPath });

  assert.throws(() => getBotAuthConfig(config, 'greg'), /has no entry for GitHub bot "greg"/);
});

test('loadAuthConfig preserves config-derived app_slug metadata for bots', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-auth-config-'));
  const authConfigPath = path.join(tempDirectory, 'auth.json');

  await writeFile(
    authConfigPath,
    JSON.stringify({
      version: 1,
      bots: {
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

  assert.equal(config.bots.greg?.appSlug, 'GR3G-BOT');
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
      caller_to_bot: {
        Greg: 'greg',
      },
    }),
  );

  const config = await loadRepoConfig({ cwd: repoDirectory });
  const repository = resolveRepository(config, 'octo/demo');

  assert.equal(repository.fullName, 'octo/demo');
});

test('resolveProjectCommandConfig uses repo config defaults when explicit overrides are absent', async () => {
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
      caller_to_bot: {
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

  const config = await loadRepoConfig({ cwd: repoDirectory });

  assert.deepEqual(resolveProjectCommandConfig(config), {
    projectOwner: 'throw-if-null',
    projectNumber: 1,
    statusFieldName: 'Status',
  });
});

test('resolveProjectCommandConfig allows explicit overrides to replace project defaults', async () => {
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
      caller_to_bot: {
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

  const config = await loadRepoConfig({ cwd: repoDirectory });

  assert.deepEqual(
    resolveProjectCommandConfig(config, {
      project_owner: 'octo-org',
      project_number: 9,
      status_field_name: 'Delivery',
    }),
    {
      projectOwner: 'octo-org',
      projectNumber: 9,
      statusFieldName: 'Delivery',
    },
  );
});

test('resolveProjectCommandConfig requires explicit project owner when repo config has no default owner', async () => {
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
      caller_to_bot: {
        Greg: 'greg',
      },
      projects: {
        default: {
          project_number: 1,
          status_field_name: 'Status',
        },
      },
    }),
  );

  const config = await loadRepoConfig({ cwd: repoDirectory });

  assert.throws(
    () => resolveProjectCommandConfig(config),
    /Project commands require --project-owner when .* has no projects\.default\.owner/,
  );
});

test('resolveProjectCommandConfig requires explicit project number when repo config has no default project number', async () => {
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
      caller_to_bot: {
        Greg: 'greg',
      },
      projects: {
        default: {
          owner: 'throw-if-null',
          status_field_name: 'Status',
        },
      },
    }),
  );

  const config = await loadRepoConfig({ cwd: repoDirectory });

  assert.throws(
    () => resolveProjectCommandConfig(config),
    /Project commands require --project-number when .* has no projects\.default\.project_number/,
  );
});

test('resolveProjectCommandConfig falls back to literal Status when no default status field exists', async () => {
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
      caller_to_bot: {
        Greg: 'greg',
      },
      projects: {
        default: {
          owner: 'throw-if-null',
          project_number: 1,
        },
      },
    }),
  );

  const config = await loadRepoConfig({ cwd: repoDirectory });

  assert.deepEqual(resolveProjectCommandConfig(config), {
    projectOwner: 'throw-if-null',
    projectNumber: 1,
    statusFieldName: 'Status',
  });
});

test('resolveProjectCommandConfig can use default project coordinates when issue create explicitly opts in', async () => {
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
      caller_to_bot: {
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

  const config = await loadRepoConfig({ cwd: repoDirectory });

  assert.deepEqual(resolveProjectCommandConfig(config, { add_to_project: true }), {
    projectOwner: 'throw-if-null',
    projectNumber: 1,
    statusFieldName: 'Status',
  });
});
