import { OrfeError } from '../../../errors.js';
import type { CommandContext, CommandInput } from '../../../types.js';
import {
  assertPrTargetIsPullRequest,
  getGitHubRequestStatus,
  normalizePullRequestUpdateResponse,
  type PullRequestGetResponseData,
  type PullRequestUpdateData,
} from '../shared.js';
import { preparePullRequestBodyFromInput } from '../../body-contract-shared.js';

interface PullRequestUpdateMutation {
  title?: string;
  body?: string;
}

export async function handlePrUpdate(context: CommandContext<'pr update'>): Promise<PullRequestUpdateData> {
  const prNumber = context.input.pr_number as number;
  const mutation = await buildPullRequestUpdateMutation(context);

  try {
    const { rest } = await context.getGitHubClient();
    await assertPrTargetIsPullRequest(rest, context.repo.owner, context.repo.name, prNumber, mapPullRequestUpdateError);
    const response = await rest.pulls.update({
      owner: context.repo.owner,
      repo: context.repo.name,
      pull_number: prNumber,
      ...mutation,
    });

    return normalizePullRequestUpdateResponse(response.data as PullRequestGetResponseData);
  } catch (error) {
    throw mapPullRequestUpdateError(error, prNumber);
  }
}

async function buildPullRequestUpdateMutation(context: CommandContext<'pr update'>): Promise<PullRequestUpdateMutation> {
  const input = context.input as CommandInput;
  const mutation: PullRequestUpdateMutation = {};

  if (typeof input.title === 'string') {
    mutation.title = input.title;
  }

  const body = await preparePullRequestBodyFromInput(context);
  if (typeof body === 'string') {
    mutation.body = body;
  }

  return mutation;
}

function mapPullRequestUpdateError(error: unknown, prNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Pull request #${prNumber} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while updating pull request #${prNumber}.`);
    }

    return new OrfeError(
      'internal_error',
      `GitHub API request failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        retryable: status >= 500 || status === 429,
      },
    );
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub pull request update failure.');
}
