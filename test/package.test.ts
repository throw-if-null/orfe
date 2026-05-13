import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test } from 'vitest';
import { fileURLToPath } from 'node:url';

import { getRuntimeInfo } from '../src/version.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(testDir, '..');

async function readJsonFile(filePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
}

test('package manifest keeps the public CLI and plugin entrypoints stable', async () => {
  const packageJson = await readJsonFile(resolve(workspaceRoot, 'package.json'));
  const files = packageJson.files as string[] | undefined;
  const bin = packageJson.bin as Record<string, string> | undefined;
  const exportsField = packageJson.exports as Record<string, string> | undefined;

  assert.equal(packageJson.main, './dist/opencode/tool.js');
  assert.equal(exportsField?.['.'], './dist/opencode/tool.js');
  assert.equal(exportsField?.['./plugin'], './dist/opencode/plugin.js');
  assert.equal(bin?.orfe, './dist/cli/entrypoint.js');
  assert.ok(files?.includes('dist'));
  assert.ok(files?.includes('README.md'));
});

test('CLI source keeps a node shebang for packaged execution', async () => {
  const cliSource = await readFile(resolve(workspaceRoot, 'src/cli/entrypoint.ts'), 'utf8');

  assert.match(cliSource, /^#!\/usr\/bin\/env node/m);
});

test('runtime info reads the active package version at runtime', async () => {
  const packageJson = await readJsonFile(resolve(workspaceRoot, 'package.json'));

  assert.deepEqual(getRuntimeInfo('cli'), {
    orfe_version: packageJson.version,
    entrypoint: 'cli',
  });
});
