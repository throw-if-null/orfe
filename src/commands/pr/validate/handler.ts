import { validateArtifactBody } from '../../../templates.js';
import type { CommandContext } from '../../../types.js';
import type { PullRequestValidateData } from '../shared.js';

export async function handlePrValidate(context: CommandContext<'pr validate'>): Promise<PullRequestValidateData> {
  const body = context.input.body as string;

  return validateArtifactBody({
    artifactType: 'pr',
    body,
    ...(typeof context.input.template === 'string' ? { template: context.input.template } : {}),
    repoConfig: context.repoConfig,
  });
}
