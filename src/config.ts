import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { OrfeError } from './errors.js';
import { expandUserPath, findUp, resolveFromCwd } from './path.js';
import type { GitHubAppRoleAuthConfig, MachineAuthConfig, RepoLocalConfig, RepoRef } from './types.js';

export const DEFAULT_REPO_CONFIG_PATH = '.orfe/config.json';
export const DEFAULT_AUTH_CONFIG_PATH = '~/.config/orfe/auth.json';

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
  project_owner?: unknown;
  project_number?: unknown;
  status_field_name?: unknown;
}

export interface ResolvedProjectConfig {
  projectOwner: string;
  projectNumber: number;
  statusFieldName: string;
}

type ProjectDefaults = RepoLocalConfig['projects'] extends infer T ? (T extends { default?: infer D } ? D : never) : never;

export async function loadRepoConfig(options: LoadRepoConfigOptions = {}): Promise<RepoLocalConfig> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const configPath = await resolveRepoConfigPath(cwd, options.configPath);
  const parsed = await readJsonFile(configPath, 'repo-local config');

  if (!isObject(parsed)) {
    throw new OrfeError('config_invalid', `Repo config at ${configPath} must contain a JSON object.`);
  }

  const version = expectLiteralNumber(parsed.version, 1, `${configPath}: version`);
  const repository = expectObject(parsed.repository, `${configPath}: repository`);
  const callerToGitHubRole = expectObject(parsed.caller_to_github_role, `${configPath}: caller_to_github_role`);

  const loadedConfig: RepoLocalConfig = {
    configPath,
    version,
    repository: {
      owner: expectString(repository.owner, `${configPath}: repository.owner`),
      name: expectString(repository.name, `${configPath}: repository.name`),
      defaultBranch: expectString(repository.default_branch, `${configPath}: repository.default_branch`),
    },
    callerToGitHubRole: readCallerRoleMapping(callerToGitHubRole, configPath),
  };

  if ('projects' in parsed && parsed.projects !== undefined) {
    const projects = expectObject(parsed.projects, `${configPath}: projects`);

    if ('default' in projects && projects.default !== undefined) {
      const projectDefaults = expectObject(projects.default, `${configPath}: projects.default`);
      loadedConfig.projects = {
        default: {
          ...('owner' in projectDefaults && projectDefaults.owner !== undefined
            ? { owner: expectString(projectDefaults.owner, `${configPath}: projects.default.owner`) }
            : {}),
          ...('project_number' in projectDefaults && projectDefaults.project_number !== undefined
            ? { projectNumber: expectNumber(projectDefaults.project_number, `${configPath}: projects.default.project_number`) }
            : {}),
          ...('status_field_name' in projectDefaults && projectDefaults.status_field_name !== undefined
            ? {
                statusFieldName: expectString(
                  projectDefaults.status_field_name,
                  `${configPath}: projects.default.status_field_name`,
                ),
              }
            : {}),
        },
      };
    }
  }

  return loadedConfig;
}

export async function loadAuthConfig(options: LoadAuthConfigOptions = {}): Promise<MachineAuthConfig> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const authConfigPath = resolveAuthConfigPath(cwd, options.authConfigPath, options.homeDirectory);
  const parsed = await readJsonFile(authConfigPath, 'machine-local auth config');

  if (!isObject(parsed)) {
    throw new OrfeError('config_invalid', `Auth config at ${authConfigPath} must contain a JSON object.`);
  }

  const version = expectLiteralNumber(parsed.version, 1, `${authConfigPath}: version`);
  const roles = expectObject(parsed.roles, `${authConfigPath}: roles`);
  const loadedRoles: MachineAuthConfig['roles'] = {};

  for (const [roleName, roleValue] of Object.entries(roles)) {
    const roleObject = expectObject(roleValue, `${authConfigPath}: roles.${roleName}`);
    const provider = expectString(roleObject.provider, `${authConfigPath}: roles.${roleName}.provider`);

    if (provider !== 'github-app') {
      throw new OrfeError(
        'config_invalid',
        `Auth config at ${authConfigPath} only supports provider "github-app" in v1. Received "${provider}" for role "${roleName}".`,
      );
    }

    loadedRoles[roleName] = {
      provider: 'github-app',
      appId: expectNumber(roleObject.app_id, `${authConfigPath}: roles.${roleName}.app_id`),
      appSlug: expectString(roleObject.app_slug, `${authConfigPath}: roles.${roleName}.app_slug`),
      privateKeyPath: expandUserPath(
        expectString(roleObject.private_key_path, `${authConfigPath}: roles.${roleName}.private_key_path`),
        options.homeDirectory,
      ),
    };
  }

  return {
    configPath: authConfigPath,
    version,
    roles: loadedRoles,
  };
}

export function resolveCallerRole(config: RepoLocalConfig, callerName: string): string {
  const normalizedCallerName = callerName.trim();

  if (normalizedCallerName.length === 0) {
    throw new OrfeError('caller_name_missing', 'Caller name is required.');
  }

  const roleName = config.callerToGitHubRole[normalizedCallerName];
  if (!roleName) {
    throw new OrfeError('caller_name_unmapped', `Caller name "${normalizedCallerName}" is not mapped in ${config.configPath}.`);
  }

  return roleName;
}

export function resolveRepository(config: RepoLocalConfig, repoOverride?: string): RepoRef {
  if (!repoOverride) {
    return createRepoRef(config.repository.owner, config.repository.name);
  }

  const parts = repoOverride.split('/');
  if (parts.length !== 2 || parts[0]!.trim().length === 0 || parts[1]!.trim().length === 0) {
    throw new OrfeError('invalid_usage', `Repository must be in "owner/name" format. Received "${repoOverride}".`);
  }

  return createRepoRef(parts[0]!.trim(), parts[1]!.trim());
}

export function getRoleAuthConfig(config: MachineAuthConfig, roleName: string): GitHubAppRoleAuthConfig {
  const roleConfig = config.roles[roleName];

  if (!roleConfig) {
    throw new OrfeError('auth_failed', `Auth config at ${config.configPath} has no entry for GitHub role "${roleName}".`);
  }

  return roleConfig;
}

export function resolveProjectCommandConfig(
  config: RepoLocalConfig,
  options: ProjectCommandOptions = {},
): ResolvedProjectConfig {
  const projectDefaults = config.projects?.default;
  const projectOwner = readProjectOwner(options, projectDefaults, config.configPath);
  const projectNumber = readProjectNumber(options, projectDefaults, config.configPath);
  const statusFieldName = readStatusFieldName(options, projectDefaults);

  return {
    projectOwner,
    projectNumber,
    statusFieldName,
  };
}

async function resolveRepoConfigPath(cwd: string, configPath?: string): Promise<string> {
  if (configPath) {
    return resolveFromCwd(cwd, configPath);
  }

  const foundPath = await findUp(cwd, DEFAULT_REPO_CONFIG_PATH);
  return foundPath ?? path.resolve(cwd, DEFAULT_REPO_CONFIG_PATH);
}

function resolveAuthConfigPath(cwd: string, authConfigPath?: string, homeDirectory?: string): string {
  const targetPath = authConfigPath ?? DEFAULT_AUTH_CONFIG_PATH;
  const expandedPath = expandUserPath(targetPath, homeDirectory);
  return resolveFromCwd(cwd, expandedPath);
}

async function readJsonFile(filePath: string, label: string): Promise<unknown> {
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

function createRepoRef(owner: string, name: string): RepoRef {
  return {
    owner,
    name,
    fullName: `${owner}/${name}`,
  };
}

function readCallerRoleMapping(value: Record<string, unknown>, configPath: string): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const [callerName, roleName] of Object.entries(value)) {
    if (callerName.trim().length === 0) {
      throw new OrfeError('config_invalid', `Repo config at ${configPath} contains an empty caller_to_github_role key.`);
    }

    mapping[callerName] = expectString(roleName, `${configPath}: caller_to_github_role.${callerName}`);
  }

  return mapping;
}

function readProjectOwner(
  options: ProjectCommandOptions,
  defaults: ProjectDefaults | undefined,
  configPath: string,
): string {
  if (typeof options.project_owner === 'string' && options.project_owner.trim().length > 0) {
    return options.project_owner.trim();
  }

  if (defaults?.owner) {
    return defaults.owner;
  }

  throw new OrfeError(
    'invalid_usage',
    `Project commands require --project-owner when ${configPath} has no projects.default.owner.`,
  );
}

function readProjectNumber(
  options: ProjectCommandOptions,
  defaults: ProjectDefaults | undefined,
  configPath: string,
): number {
  if (typeof options.project_number === 'number' && Number.isInteger(options.project_number) && options.project_number >= 0) {
    return options.project_number;
  }

  if (defaults?.projectNumber !== undefined) {
    return defaults.projectNumber;
  }

  throw new OrfeError(
    'invalid_usage',
    `Project commands require --project-number when ${configPath} has no projects.default.project_number.`,
  );
}

function readStatusFieldName(
  options: ProjectCommandOptions,
  defaults: ProjectDefaults | undefined,
): string {
  if (typeof options.status_field_name === 'string' && options.status_field_name.trim().length > 0) {
    return options.status_field_name.trim();
  }

  return defaults?.statusFieldName ?? 'Status';
}

function expectLiteralNumber(value: unknown, expected: 1, label: string): 1 {
  if (value !== expected) {
    throw new OrfeError('config_invalid', `${label} must be ${expected}.`);
  }

  return expected;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OrfeError('config_invalid', `${label} must be a non-empty string.`);
  }

  return value;
}

function expectNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new OrfeError('config_invalid', `${label} must be a non-negative integer.`);
  }

  return value;
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new OrfeError('config_invalid', `${label} must be an object.`);
  }

  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
