import { validateArtifactBody } from '../../../body-contracts.js';
import type { CommandContext } from '../../../types.js';
import type { IssueValidateData } from '../shared.js';

export async function handleIssueValidate(context: CommandContext<'issue validate'>): Promise<IssueValidateData> {
  const body = context.input.body as string;

  return validateArtifactBody({
    artifactType: 'issue',
    body,
    ...(typeof context.input.body_contract === 'string' ? { bodyContract: context.input.body_contract } : {}),
    repoConfig: context.repoConfig,
  });
}
