import type { RepoLocalConfig } from '../config/types.js';

import { prepareArtifactBody } from './prepare.js';

export interface ArtifactBodyInput {
  body?: unknown;
  template?: unknown;
}

export async function prepareIssueBodyFromInput(input: ArtifactBodyInput, repoConfig: RepoLocalConfig): Promise<string | undefined> {
  return prepareBodyFromInput('issue', input, repoConfig);
}

export async function preparePullRequestBodyFromInput(
  input: ArtifactBodyInput,
  repoConfig: RepoLocalConfig,
): Promise<string | undefined> {
  return prepareBodyFromInput('pr', input, repoConfig);
}

async function prepareBodyFromInput(
  artifactType: 'issue' | 'pr',
  input: ArtifactBodyInput,
  repoConfig: RepoLocalConfig,
): Promise<string | undefined> {
  const preparedBody = await prepareArtifactBody({
    artifactType,
    ...(typeof input.body === 'string' ? { body: input.body } : {}),
    ...(typeof input.template === 'string' ? { template: input.template } : {}),
    repoConfig,
  });

  return preparedBody?.body ?? (typeof input.body === 'string' ? input.body : undefined);
}
