import type { GitHubClients } from '../../../github/types.js';
import { OrfeError } from '../../../runtime/errors.js';
import type { PullRequestCommentData } from '../comment/output.js';
import type { PullRequestGetData } from '../get/output.js';
import type { PullRequestGetOrCreateData } from '../get-or-create/output.js';
import type { PullRequestReplyData } from '../reply/output.js';
import type { PullRequestSubmitReviewData } from '../submit-review/output.js';
import type { PullRequestUpdateData } from '../update/output.js';
import type { PullRequestReviewEvent } from './review.js';

interface PullRequestRefData {
  ref?: unknown;
}

export interface PullRequestCommentResponseData {
  id?: unknown;
  html_url?: unknown;
}

export interface PullRequestReplyResponseData {
  id?: unknown;
  in_reply_to_id?: unknown;
}

export interface PullRequestSubmitReviewResponseData {
  id?: unknown;
}

export interface PullRequestGetResponseData {
  number?: unknown;
  title?: unknown;
  body?: unknown;
  state?: unknown;
  draft?: unknown;
  head?: unknown;
  base?: unknown;
  html_url?: unknown;
}

export interface PullRequestSummaryData {
  pr_number: number;
  draft: boolean;
  head: string;
  base: string;
  html_url: string;
}

export async function assertPrTargetIsPullRequest(
  rest: GitHubClients['rest'],
  owner: string,
  repo: string,
  prNumber: number,
  mapError: (error: unknown, prNumber: number) => OrfeError,
): Promise<void> {
  try {
    await rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
  } catch (error) {
    throw mapError(error, prNumber);
  }
}

export function normalizePullRequestCommentResponse(
  prNumber: number,
  comment: PullRequestCommentResponseData,
): PullRequestCommentData {
  if (typeof comment.id !== 'number' || !Number.isInteger(comment.id)) {
    throw new OrfeError('internal_error', `GitHub comment response for pull request #${prNumber} is missing a valid id.`);
  }

  if (typeof comment.html_url !== 'string' || comment.html_url.length === 0) {
    throw new OrfeError('internal_error', `GitHub comment response for pull request #${prNumber} is missing a valid html_url.`);
  }

  return {
    pr_number: prNumber,
    comment_id: comment.id,
    html_url: comment.html_url,
    created: true,
  };
}

export function normalizePullRequestReplyResponse(
  prNumber: number,
  expectedInReplyToCommentId: number,
  comment: PullRequestReplyResponseData,
): PullRequestReplyData {
  if (typeof comment.id !== 'number' || !Number.isInteger(comment.id)) {
    throw new OrfeError('internal_error', `GitHub reply response for pull request #${prNumber} is missing a valid id.`);
  }

  if (typeof comment.in_reply_to_id !== 'number' || !Number.isInteger(comment.in_reply_to_id)) {
    throw new OrfeError(
      'internal_error',
      `GitHub reply response for pull request #${prNumber} is missing a valid in_reply_to_id.`,
    );
  }

  if (comment.in_reply_to_id !== expectedInReplyToCommentId) {
    throw new OrfeError(
      'internal_error',
      `GitHub reply response for pull request #${prNumber} referenced review comment #${comment.in_reply_to_id} instead of #${expectedInReplyToCommentId}.`,
    );
  }

  return {
    pr_number: prNumber,
    comment_id: comment.id,
    in_reply_to_comment_id: comment.in_reply_to_id,
    created: true,
  };
}

export function normalizePullRequestSubmitReviewResponse(
  prNumber: number,
  event: PullRequestReviewEvent,
  review: PullRequestSubmitReviewResponseData,
): PullRequestSubmitReviewData {
  if (typeof review.id !== 'number' || !Number.isInteger(review.id)) {
    throw new OrfeError('internal_error', `GitHub review response for pull request #${prNumber} is missing a valid id.`);
  }

  return {
    pr_number: prNumber,
    review_id: review.id,
    event,
    submitted: true,
  };
}

export function normalizePullRequestGetResponse(pullRequest: PullRequestGetResponseData): PullRequestGetData {
  const prNumber = readPullRequestNumber(pullRequest);

  if (typeof pullRequest.title !== 'string') {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid title.`);
  }

  if (typeof pullRequest.state !== 'string' || pullRequest.state.length === 0) {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid state.`);
  }

  if (typeof pullRequest.draft !== 'boolean') {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid draft flag.`);
  }

  if (typeof pullRequest.html_url !== 'string' || pullRequest.html_url.length === 0) {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid html_url.`);
  }

  return {
    title: pullRequest.title,
    body: typeof pullRequest.body === 'string' ? pullRequest.body : '',
    state: pullRequest.state,
    ...normalizePullRequestSummaryResponse(pullRequest),
  };
}

export function normalizePullRequestSummaryResponse(pullRequest: PullRequestGetResponseData): PullRequestSummaryData {
  const prNumber = readPullRequestNumber(pullRequest);

  if (typeof pullRequest.draft !== 'boolean') {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid draft flag.`);
  }

  if (typeof pullRequest.html_url !== 'string' || pullRequest.html_url.length === 0) {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid html_url.`);
  }

  return {
    pr_number: prNumber,
    draft: pullRequest.draft,
    head: readPullRequestRef(pullRequest.head, prNumber, 'head'),
    base: readPullRequestRef(pullRequest.base, prNumber, 'base'),
    html_url: pullRequest.html_url,
  };
}

export function normalizePullRequestGetOrCreateData(summary: PullRequestSummaryData, created: boolean): PullRequestGetOrCreateData {
  return {
    pr_number: summary.pr_number,
    html_url: summary.html_url,
    head: summary.head,
    base: summary.base,
    draft: summary.draft,
    created,
  };
}

export function normalizePullRequestUpdateResponse(pullRequest: PullRequestGetResponseData): PullRequestUpdateData {
  const normalizedPullRequest = normalizePullRequestGetResponse(pullRequest);

  return {
    pr_number: normalizedPullRequest.pr_number,
    title: normalizedPullRequest.title,
    html_url: normalizedPullRequest.html_url,
    head: normalizedPullRequest.head,
    base: normalizedPullRequest.base,
    draft: normalizedPullRequest.draft,
    changed: true,
  };
}

function readPullRequestNumber(pullRequest: PullRequestGetResponseData): number {
  if (typeof pullRequest.number !== 'number' || !Number.isInteger(pullRequest.number)) {
    throw new OrfeError('internal_error', 'GitHub pull request response is missing a valid number.');
  }

  return pullRequest.number;
}

function readPullRequestRef(value: unknown, prNumber: number, label: 'head' | 'base'): string {
  if (!isObject(value)) {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid ${label} object.`);
  }

  const ref = (value as PullRequestRefData).ref;
  if (typeof ref !== 'string' || ref.length === 0) {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid ${label}.ref value.`);
  }

  return ref;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
