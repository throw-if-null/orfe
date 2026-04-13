import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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

  assert.equal(packageJson.name, 'orfe');
  assert.equal(packageJson.private, undefined);
  assert.match(String(packageJson.description), /GitHub operations runtime/i);
  assert.equal(bin?.orfe, './dist/cli.js');
  assert.equal(scripts?.prepack, 'npm run build');
  assert.ok(files?.includes('dist'));
  assert.ok(files?.includes('README.md'));
  assert.ok(files?.includes('docs'));
});

test('CLI source keeps a node shebang for packaged execution', async () => {
  const cliSource = await readFile(resolve(workspaceRoot, 'src/cli.ts'), 'utf8');

  assert.match(cliSource, /^#!\/usr\/bin\/env node/m);
});
