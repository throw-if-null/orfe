import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findUp } from '../path.js';

export async function resolveTemplatesRoot(configPath: string): Promise<string> {
  const configDirectory = path.dirname(configPath);

  if (path.basename(configDirectory) === '.orfe') {
    return path.join(configDirectory, 'templates');
  }

  const canonicalConfigPath = await findUp(configDirectory, '.orfe/config.json');
  if (canonicalConfigPath) {
    return path.join(path.dirname(canonicalConfigPath), 'templates');
  }

  const sourceRelativeTemplatesRoot = await findUp(path.dirname(fileURLToPath(import.meta.url)), '.orfe/templates');
  if (sourceRelativeTemplatesRoot) {
    return sourceRelativeTemplatesRoot;
  }

  const runtimeTemplatesRoot = await findUp(process.cwd(), '.orfe/templates');
  if (runtimeTemplatesRoot) {
    return runtimeTemplatesRoot;
  }

  return path.join(configDirectory, '.orfe', 'templates');
}
