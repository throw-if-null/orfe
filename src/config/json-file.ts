import { readFile } from 'node:fs/promises';

import { OrfeError } from '../runtime/errors.js';

export async function readConfigJsonFile(filePath: string, label: string): Promise<unknown> {
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
