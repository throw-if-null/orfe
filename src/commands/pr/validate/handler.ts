import { validateArtifactBody } from '../../../templates.js';
import type { CommandContext } from '../../../core/context.js';
import type { PullRequestValidateData } from './output.js';

export async function handlePrValidate(context: CommandContext<'pr validate'>): Promise<PullRequestValidateData> {
  const body = context.input.body as string;

  return validateArtifactBody({
    artifactType: 'pr',
    body,
    ...(typeof context.input.template === 'string' ? { template: context.input.template } : {}),
    repoConfig: context.repoConfig,
  });
}
