import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

export { createGitHubClientFactory, repoConfigPath, workspaceRoot };
