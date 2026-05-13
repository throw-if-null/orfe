import { OrfeError } from '../../../runtime/errors.js';
import type { CommandContext } from '../../../core/context.js';
import type { PullRequestGetData } from './output.js';
import { getGitHubRequestStatus } from '../shared/github-errors.js';
import { normalizePullRequestGetResponse, type PullRequestGetResponseData } from '../shared/github-response.js';

export async function handlePrGet(context: CommandContext<'pr get'>): Promise<PullRequestGetData> {
  const prNumber = context.input.pr_number as number;

  try {
    const { rest } = await context.getGitHubClient();
    const response = await rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.name,
      pull_number: prNumber,
    });

    return normalizePullRequestGetResponse(response.data as PullRequestGetResponseData);
  } catch (error) {
    throw mapPullRequestGetError(error, prNumber);
  }
}

function mapPullRequestGetError(error: unknown, prNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Pull request #${prNumber} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while reading pull request #${prNumber}.`);
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

  return new OrfeError('internal_error', 'Unknown GitHub pull request lookup failure.');
}
