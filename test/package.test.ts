import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { executeOrfeTool } from '../src/wrapper.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(testDir, '..');

async function readJsonFile(filePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
}

test('package metadata exposes installable orfe CLI wiring', async () => {
  const packageJson = await readJsonFile(resolve(workspaceRoot, 'package.json'));
  const scripts = packageJson.scripts as Record<string, string> | undefined;
  const files = packageJson.files as string[] | undefined;
  const bin = packageJson.bin as Record<string, string> | undefined;
  const exportsField = packageJson.exports as Record<string, string> | undefined;
  const publishConfig = packageJson.publishConfig as Record<string, string> | undefined;

  assert.equal(packageJson.name, '@mirzamerdovic/orfe');
  assert.equal(packageJson.version, '0.2.2');
  assert.equal(packageJson.private, undefined);
  assert.equal(packageJson.license, 'MIT');
  assert.match(String(packageJson.description), /GitHub operations runtime/i);
  assert.equal(packageJson.main, './dist/wrapper.js');
  assert.equal(exportsField?.['.'], './dist/wrapper.js');
  assert.equal(exportsField?.['./plugin'], './dist/plugin.js');
  assert.equal(bin?.orfe, './dist/cli.js');
  assert.equal(scripts?.prepack, 'npm run build');
  assert.ok(files?.includes('dist'));
  assert.ok(files?.includes('README.md'));
  assert.ok(!files?.includes('docs'));
  assert.equal(exportsField?.['./server'], './dist/plugin.js');
  assert.equal(publishConfig?.registry, 'https://registry.npmjs.org');
  assert.equal(publishConfig?.access, 'public');
});

test('CLI source keeps a node shebang for packaged execution', async () => {
  const cliSource = await readFile(resolve(workspaceRoot, 'src/cli.ts'), 'utf8');

  assert.match(cliSource, /^#!\/usr\/bin\/env node/m);
});

test('wrapper exports executeOrfeTool for package entry point wiring', () => {
  assert.equal(typeof executeOrfeTool, 'function');
});
