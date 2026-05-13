import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function expandUserPath(inputPath: string, homeDirectory = os.homedir()): string {
  if (inputPath === '~') {
    return homeDirectory;
  }

  if (inputPath.startsWith('~/')) {
    return path.join(homeDirectory, inputPath.slice(2));
  }

  return inputPath;
}

export function resolveFromCwd(cwd: string, inputPath: string): string {
  const expandedPath = expandUserPath(inputPath);
  return path.isAbsolute(expandedPath) ? expandedPath : path.resolve(cwd, expandedPath);
}

export async function findUp(cwd: string, relativePath: string): Promise<string | undefined> {
  let currentDirectory = path.resolve(cwd);

  while (true) {
    const candidatePath = path.join(currentDirectory, relativePath);

    try {
      await access(candidatePath);
      return candidatePath;
    } catch {
      // Continue searching upward.
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
}
