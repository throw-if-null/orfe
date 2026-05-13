import { validateArtifactBody } from '../../../templates.js';
import type { CommandContext } from '../../../core/context.js';
import type { IssueValidateData } from '../shared.js';

export async function handleIssueValidate(context: CommandContext<'issue validate'>): Promise<IssueValidateData> {
  const body = context.input.body as string;

  return validateArtifactBody({
    artifactType: 'issue',
    body,
    ...(typeof context.input.template === 'string' ? { template: context.input.template } : {}),
    repoConfig: context.repoConfig,
  });
}
