import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { OrfeError } from '../runtime/errors.js';
import { expandUserPath, findUp, resolveFromCwd } from '../path/path.js';

export const DEFAULT_REPO_CONFIG_PATH = '.orfe/config.json';
export const DEFAULT_AUTH_CONFIG_PATH = '~/.config/orfe/auth.json';

export interface RepoLocalConfig {
  configPath: string;
  version: 1;
  repository: {
    owner: string;
    name: string;
    defaultBranch: string;
  };
  callerToBot: Record<string, string>;
  projects?: {
    default?: {
      owner?: string;
      projectNumber?: number;
      statusFieldName?: string;
    };
  };
}

export interface GitHubAppBotAuthConfig {
  provider: 'github-app';
  appId: number;
  appSlug: string;
  privateKeyPath: string;
}

export interface MachineAuthConfig {
  configPath: string;
  version: 1;
  bots: Record<string, GitHubAppBotAuthConfig>;
}

export interface LoadRepoConfigOptions {
  cwd?: string;
  configPath?: string;
}

export interface LoadAuthConfigOptions {
  cwd?: string;
  authConfigPath?: string;
  homeDirectory?: string;
}

export interface ProjectCommandOptions {
  add_to_project?: unknown;
  project_owner?: unknown;
  project_number?: unknown;
  status_field_name?: unknown;
  status?: unknown;
}

export interface ResolvedProjectConfig {
  projectOwner: string;
  projectNumber: number;
  statusFieldName: string;
}

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

export async function readJsonFile(filePath: string, label: string): Promise<unknown> {
  let rawContents: string;

  try {
    rawContents = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new OrfeError('config_not_found', `${label} not found at ${filePath}.`);
    }

    throw new OrfeError('config_invalid', `Unable to read ${label} at ${filePath}.`);
  }

  try {
    return JSON.parse(rawContents) as unknown;
  } catch {
    throw new OrfeError('config_invalid', `${label} at ${filePath} is not valid JSON.`);
  }
}

export function expectLiteralNumber(value: unknown, expected: 1, label: string): 1 {
  if (value !== expected) {
    throw new OrfeError('config_invalid', `${label} must be ${expected}.`);
  }

  return expected;
}

export function expectString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OrfeError('config_invalid', `${label} must be a non-empty string.`);
  }

  return value;
}

export function expectNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new OrfeError('config_invalid', `${label} must be a non-negative integer.`);
  }

  return value;
}

export function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new OrfeError('config_invalid', `${label} must be an object.`);
  }

  return value;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
