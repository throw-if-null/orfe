import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { getRoleConfig, loadConfig } from '../src/config.js';
import { expandUserPath } from '../src/path.js';

test('expandUserPath resolves tilde paths', () => {
  assert.equal(expandUserPath('~/keys/greg.pem', '/tmp/home'), path.join('/tmp/home', 'keys/greg.pem'));
  assert.equal(expandUserPath('/tmp/keys/greg.pem', '/tmp/home'), '/tmp/keys/greg.pem');
});

test('loadConfig reads github app settings for a supported role', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'tokenner-config-'));
  const configPath = path.join(tempDirectory, 'apps.yaml');

  await writeFile(
    configPath,
    `apps:\n  greg:\n    provider: github-app\n    app_id: 123456\n    app_slug: GR3G-BOT\n    private_key_path: ~/keys/greg.pem\n`,
  );

  const config = await loadConfig({ configPath, homeDirectory: '/home/test-user' });
  const greg = getRoleConfig(config, 'greg');

  assert.equal(greg.provider.kind, 'github-app');
  assert.equal(greg.provider.appId, '123456');
  assert.equal(greg.provider.appSlug, 'GR3G-BOT');
  assert.equal(greg.provider.privateKeyPath, '/home/test-user/keys/greg.pem');
});

test('loadConfig rejects unsupported providers', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'tokenner-config-'));
  const configPath = path.join(tempDirectory, 'apps.yaml');

  await writeFile(
    configPath,
    `apps:\n  greg:\n    provider: session\n    app_id: 123456\n    app_slug: GR3G-BOT\n    private_key_path: ~/keys/greg.pem\n`,
  );

  await assert.rejects(loadConfig({ configPath }), /supports github-app only/);
});

test('getRoleConfig fails when the requested role is missing', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'tokenner-config-'));
  const configPath = path.join(tempDirectory, 'apps.yaml');

  await writeFile(
    configPath,
    `apps:\n  zoran:\n    app_id: 123456\n    app_slug: Z0R4N-BOT\n    private_key_path: ~/keys/zoran.pem\n`,
  );

  const config = await loadConfig({ configPath });

  assert.throws(() => getRoleConfig(config, 'greg'), /Role "greg" is missing/);
});
