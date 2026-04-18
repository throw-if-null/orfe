import { readFileSync } from 'node:fs';

interface PackageJsonShape {
  version?: unknown;
}

export type RuntimeEntrypoint = 'cli' | 'opencode-plugin';

export interface RuntimeInfoData {
  orfe_version: string;
  entrypoint: RuntimeEntrypoint;
}

function readPackageJson(): PackageJsonShape {
  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as PackageJsonShape;
}

export function getOrfeVersion(): string {
  const packageJson = readPackageJson();

  if (typeof packageJson.version !== 'string' || packageJson.version.trim().length === 0) {
    throw new Error('Package version is unavailable.');
  }

  return packageJson.version;
}

export function getRuntimeInfo(entrypoint: RuntimeEntrypoint): RuntimeInfoData {
  return {
    orfe_version: getOrfeVersion(),
    entrypoint,
  };
}
