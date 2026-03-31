import { readFile } from 'node:fs/promises';
import YAML from 'yaml';

import { TokennerError } from './errors.js';
import { expandUserPath } from './path.js';
import type { LoadedConfig, ProviderKind, Role, RoleConfig } from './types.js';

export const DEFAULT_CONFIG_PATH = '~/.config/tokenner/apps.yaml';

interface RawRoleConfig {
  provider?: string;
  app_id?: number | string;
  app_slug?: string;
  private_key_path?: string;
}

interface RawConfig {
  apps?: Partial<Record<Role, RawRoleConfig>>;
}

export interface LoadConfigOptions {
  configPath?: string;
  homeDirectory?: string;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<LoadedConfig> {
  const resolvedConfigPath = expandUserPath(options.configPath ?? DEFAULT_CONFIG_PATH, options.homeDirectory);

  let rawContents: string;

  try {
    rawContents = await readFile(resolvedConfigPath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new TokennerError(
        `Config file not found at ${resolvedConfigPath}. Create it with GitHub App credentials before running tokenner.`,
      );
    }

    throw new TokennerError(`Unable to read config file at ${resolvedConfigPath}.`);
  }

  let parsed: RawConfig;

  try {
    parsed = YAML.parse(rawContents) as RawConfig;
  } catch {
    throw new TokennerError(`Config file at ${resolvedConfigPath} is not valid YAML.`);
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.apps || typeof parsed.apps !== 'object') {
    throw new TokennerError(`Config file at ${resolvedConfigPath} must contain an "apps" mapping.`);
  }

  const roles: LoadedConfig['roles'] = {};

  for (const [roleName, rawRoleConfig] of Object.entries(parsed.apps)) {
    if (!rawRoleConfig) {
      continue;
    }

    const role = assertRole(roleName);
    const providerKind = assertProviderKind(rawRoleConfig.provider);
    const appId = normalizeString(rawRoleConfig.app_id, `${role}.app_id`, resolvedConfigPath);
    const appSlug = normalizeString(rawRoleConfig.app_slug, `${role}.app_slug`, resolvedConfigPath);
    const privateKeyPath = normalizeString(
      rawRoleConfig.private_key_path,
      `${role}.private_key_path`,
      resolvedConfigPath,
    );

    const roleConfig: RoleConfig = {
      role,
      provider: {
        kind: providerKind,
        appId,
        appSlug,
        privateKeyPath: expandUserPath(privateKeyPath, options.homeDirectory),
      },
    };

    roles[role] = roleConfig;
  }

  return {
    configPath: resolvedConfigPath,
    roles,
  };
}

export function getRoleConfig(config: LoadedConfig, role: Role): RoleConfig {
  const roleConfig = config.roles[role];

  if (!roleConfig) {
    throw new TokennerError(`Role "${role}" is missing from config file at ${config.configPath}.`);
  }

  return roleConfig;
}

function assertRole(roleName: string): Role {
  switch (roleName) {
    case 'zoran':
    case 'jelena':
    case 'greg':
    case 'klarissa':
      return roleName;
    default:
      throw new TokennerError(`Unsupported role "${roleName}" found in config. Supported roles: zoran, jelena, greg, klarissa.`);
  }
}

function assertProviderKind(provider: string | undefined): ProviderKind {
  if (!provider || provider === 'github-app') {
    return 'github-app';
  }

  throw new TokennerError(`Unsupported provider "${provider}" in config. tokenner v1 supports github-app only.`);
}

function normalizeString(value: number | string | undefined, fieldName: string, configPath: string): string {
  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  throw new TokennerError(`Config file at ${configPath} is missing a valid value for ${fieldName}.`);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
