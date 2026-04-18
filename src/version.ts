import { readFileSync } from 'node:fs';

interface PackageJsonShape {
  version?: unknown;
}

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as PackageJsonShape;

export function getOrfeVersion(): string {
  if (typeof packageJson.version !== 'string' || packageJson.version.trim().length === 0) {
    throw new Error('Package version is unavailable.');
  }

  return packageJson.version;
}
