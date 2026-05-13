import { OrfeError } from '../../../runtime/errors.js';
import type { CommandContext } from '../../../core/context.js';
import {
  assertPrTargetIsPullRequest,
  getGitHubRequestStatus,
  normalizePullRequestSubmitReviewResponse,
  type PullRequestSubmitReviewData,
  type PullRequestSubmitReviewResponseData,
} from '../shared.js';
import { readPullRequestReviewEvent } from './errors.js';

export async function handlePrSubmitReview(context: CommandContext<'pr submit-review'>): Promise<PullRequestSubmitReviewData> {
  const prNumber = context.input.pr_number as number;
  const event = readPullRequestReviewEvent(context.input.event);
  const body = context.input.body as string;

  try {
    const { rest } = await context.getGitHubClient();
    await assertPrTargetIsPullRequest(rest, context.repo.owner, context.repo.name, prNumber, mapPullRequestSubmitReviewError);
    const response = await rest.pulls.createReview({
      owner: context.repo.owner,
      repo: context.repo.name,
      pull_number: prNumber,
      body,
      event: mapPullRequestReviewEvent(event),
    });

    return normalizePullRequestSubmitReviewResponse(prNumber, event, response.data as PullRequestSubmitReviewResponseData);
  } catch (error) {
    throw mapPullRequestSubmitReviewError(error, prNumber);
  }
}

function mapPullRequestReviewEvent(value: 'approve' | 'request-changes' | 'comment'): 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' {
  switch (value) {
    case 'approve':
      return 'APPROVE';
    case 'request-changes':
      return 'REQUEST_CHANGES';
    case 'comment':
      return 'COMMENT';
  }
}

function mapPullRequestSubmitReviewError(error: unknown, prNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Pull request #${prNumber} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while submitting a review on pull request #${prNumber}.`);
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

  return new OrfeError('internal_error', 'Unknown GitHub pull request review submission failure.');
}
