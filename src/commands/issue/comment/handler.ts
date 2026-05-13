import { OrfeError } from '../../../runtime/errors.js';
import type { CommandContext } from '../../../core/context.js';
import {
  assertIssueTargetIsIssue,
  getGitHubRequestStatus,
  normalizeIssueCommentResponse,
  type IssueCommentData,
  type IssueCommentResponseData,
} from '../shared.js';

export async function handleIssueComment(context: CommandContext<'issue comment'>): Promise<IssueCommentData> {
  const issueNumber = context.input.issue_number as number;
  const body = context.input.body as string;

  try {
    const { rest } = await context.getGitHubClient();
    await assertIssueTargetIsIssue({
      rest,
      owner: context.repo.owner,
      repo: context.repo.name,
      issueNumber,
      conflictMessage: `Issue #${issueNumber} is a pull request. Use pr comment instead.`,
      mapError: mapIssueCommentError,
    });
    const response = await rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.name,
      issue_number: issueNumber,
      body,
    });

    return normalizeIssueCommentResponse(issueNumber, response.data as IssueCommentResponseData);
  } catch (error) {
    throw mapIssueCommentError(error, issueNumber);
  }
}

function mapIssueCommentError(error: unknown, issueNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Issue #${issueNumber} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while commenting on issue #${issueNumber}.`);
    }

    return new OrfeError('internal_error', `GitHub API request failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      retryable: status >= 500 || status === 429,
    });
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub issue comment failure.');
}
