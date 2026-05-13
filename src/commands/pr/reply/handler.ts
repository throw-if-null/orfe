import { OrfeError } from '../../../runtime/errors.js';
import type { CommandContext } from '../../../core/context.js';
import type { PullRequestReplyData } from './output.js';
import { getGitHubRequestStatus } from '../shared/github-errors.js';
import {
  assertPrTargetIsPullRequest,
  normalizePullRequestReplyResponse,
  type PullRequestReplyResponseData,
} from '../shared/github-response.js';

export async function handlePrReply(context: CommandContext<'pr reply'>): Promise<PullRequestReplyData> {
  const prNumber = context.input.pr_number as number;
  const commentId = context.input.comment_id as number;
  const body = context.input.body as string;

  try {
    const { rest } = await context.getGitHubClient();
    await assertPrTargetIsPullRequest(rest, context.repo.owner, context.repo.name, prNumber, mapPullRequestReplyTargetError);
    const response = await rest.pulls.createReplyForReviewComment({
      owner: context.repo.owner,
      repo: context.repo.name,
      pull_number: prNumber,
      comment_id: commentId,
      body,
    });

    return normalizePullRequestReplyResponse(prNumber, commentId, response.data as PullRequestReplyResponseData);
  } catch (error) {
    throw mapPullRequestReplyError(error, prNumber, commentId);
  }
}

function mapPullRequestReplyTargetError(error: unknown, prNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Pull request #${prNumber} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while replying on pull request #${prNumber}.`);
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

  return new OrfeError('internal_error', 'Unknown GitHub pull request reply target lookup failure.');
}

function mapPullRequestReplyError(error: unknown, prNumber: number, commentId: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Review comment #${commentId} was not found on pull request #${prNumber}.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError(
        'auth_failed',
        `GitHub App authentication failed while replying to review comment #${commentId} on pull request #${prNumber}.`,
      );
    }

    if (status === 422) {
      return new OrfeError(
        'github_conflict',
        `GitHub rejected reply to review comment #${commentId} on pull request #${prNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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

  return new OrfeError('internal_error', 'Unknown GitHub pull request reply failure.');
}
