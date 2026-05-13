import { OrfeError } from '../runtime/errors.js';

import type { RepoLocalConfig } from './shared.js';

export interface RepoRef {
  owner: string;
  name: string;
  fullName: string;
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

function createRepoRef(owner: string, name: string): RepoRef {
  return {
    owner,
    name,
    fullName: `${owner}/${name}`,
  };
}
