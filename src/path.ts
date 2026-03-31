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
