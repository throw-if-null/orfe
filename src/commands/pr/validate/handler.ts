import { validateArtifactBody } from '../../../body-contracts.js';
import type { CommandContext } from '../../../types.js';
import type { PullRequestValidateData } from '../shared.js';

export async function handlePrValidate(context: CommandContext<'pr validate'>): Promise<PullRequestValidateData> {
  const body = context.input.body as string;

  return validateArtifactBody({
    artifactType: 'pr',
    body,
    ...(typeof context.input.body_contract === 'string' ? { bodyContract: context.input.body_contract } : {}),
    repoConfig: context.repoConfig,
  });
}
