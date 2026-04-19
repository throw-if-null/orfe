import { prepareArtifactBody } from '../body-contracts.js';
import type { CommandContext, CommandInput } from '../types.js';

export async function prepareIssueBodyFromInput(
  context: Pick<CommandContext, 'input' | 'repoConfig'>,
): Promise<string | undefined> {
  const input = context.input as CommandInput;
  const preparedBody = await prepareArtifactBody({
    artifactType: 'issue',
    ...(typeof input.body === 'string' ? { body: input.body } : {}),
    ...(typeof input.body_contract === 'string' ? { bodyContract: input.body_contract } : {}),
    repoConfig: context.repoConfig,
  });

  return preparedBody?.body ?? (typeof input.body === 'string' ? input.body : undefined);
}

export async function preparePullRequestBodyFromInput(
  context: Pick<CommandContext, 'input' | 'repoConfig'>,
): Promise<string | undefined> {
  const input = context.input as CommandInput;
  const preparedBody = await prepareArtifactBody({
    artifactType: 'pr',
    ...(typeof input.body === 'string' ? { body: input.body } : {}),
    ...(typeof input.body_contract === 'string' ? { bodyContract: input.body_contract } : {}),
    repoConfig: context.repoConfig,
  });

  return preparedBody?.body ?? (typeof input.body === 'string' ? input.body : undefined);
}
