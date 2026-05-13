import { OrfeError } from '../../../runtime/errors.js';
import type { CommandContext } from '../../../core/context.js';
import type { PullRequestCommentData } from './output.js';
import { getGitHubRequestStatus } from '../shared/github-errors.js';
import {
  assertPrTargetIsPullRequest,
  normalizePullRequestCommentResponse,
  type PullRequestCommentResponseData,
} from '../shared/github-response.js';

export async function handlePrComment(context: CommandContext<'pr comment'>): Promise<PullRequestCommentData> {
  const prNumber = context.input.pr_number as number;
  const body = context.input.body as string;

  try {
    const { rest } = await context.getGitHubClient();
    await assertPrTargetIsPullRequest(rest, context.repo.owner, context.repo.name, prNumber, mapPullRequestCommentError);
    const response = await rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.name,
      issue_number: prNumber,
      body,
    });

    return normalizePullRequestCommentResponse(prNumber, response.data as PullRequestCommentResponseData);
  } catch (error) {
    throw mapPullRequestCommentError(error, prNumber);
  }
}

function mapPullRequestCommentError(error: unknown, prNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Pull request #${prNumber} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while commenting on pull request #${prNumber}.`);
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

  return new OrfeError('internal_error', 'Unknown GitHub pull request comment failure.');
}
