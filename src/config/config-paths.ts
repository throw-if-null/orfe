import path from 'node:path';

import { findUp, expandUserPath, resolveFromCwd } from '../fs/path.js';

export const DEFAULT_REPO_CONFIG_PATH = '.orfe/config.json';
export const DEFAULT_AUTH_CONFIG_PATH = '~/.config/orfe/auth.json';

export async function resolveRepoConfigPath(cwd: string, configPath?: string): Promise<string> {
  if (configPath) {
    return resolveFromCwd(cwd, configPath);
  }

  const foundPath = await findUp(cwd, DEFAULT_REPO_CONFIG_PATH);
  return foundPath ?? path.resolve(cwd, DEFAULT_REPO_CONFIG_PATH);
}

export function resolveAuthConfigPath(cwd: string, authConfigPath?: string, homeDirectory?: string): string {
  const targetPath = authConfigPath ?? DEFAULT_AUTH_CONFIG_PATH;
  const expandedPath = expandUserPath(targetPath, homeDirectory);
  return resolveFromCwd(cwd, expandedPath);
}
