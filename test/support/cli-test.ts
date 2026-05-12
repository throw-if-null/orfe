import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { runCli } from '../../src/cli/run.js';
import type { RunCliDependencies } from '../../src/cli/types.js';
import {
  createAuthConfig,
  createGitHubClientFactory,
  createRepoConfigWithDefaultProject,
  repoConfigPath,
  workspaceRoot,
} from './runtime-fixtures.js';

export class MemoryStream {
  output = '';

  write(chunk: string): boolean {
    this.output += chunk;
    return true;
  }
}

export async function readPackageVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(resolve(workspaceRoot, 'package.json'), 'utf8')) as {
    version?: unknown;
  };

  return String(packageJson.version ?? '');
}

export function createRuntimeDependencies() {
  return {
    loadRepoConfigImpl: async () => createRepoConfigWithDefaultProject(),
    loadAuthConfigImpl: async () => createAuthConfig(),
  };
}

export async function invokeCli(
  args: string[],
  dependencies: Omit<RunCliDependencies, 'stdout' | 'stderr'> = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();
  const exitCode = await runCli(args, {
    stdout,
    stderr,
    ...dependencies,
  });

  return {
    exitCode,
    stdout: stdout.output,
    stderr: stderr.output,
  };
}

export { createGitHubClientFactory, repoConfigPath, workspaceRoot };
