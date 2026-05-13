import { OrfeError } from '../../../runtime/errors.js';
import type { CommandContext } from '../../../core/context.js';
import type { IssueGetData } from './output.js';
import { getGitHubRequestStatus } from '../shared/github-errors.js';
import { normalizeIssueGetResponse, type IssueGetResponseData } from '../shared/github-response.js';

export async function handleIssueGet(context: CommandContext<'issue get'>): Promise<IssueGetData> {
  const issueNumber = context.input.issue_number as number;

  try {
    const { rest } = await context.getGitHubClient();
    const response = await rest.issues.get({
      owner: context.repo.owner,
      repo: context.repo.name,
      issue_number: issueNumber,
    });

    return normalizeIssueGetResponse(response.data as IssueGetResponseData);
  } catch (error) {
    throw mapIssueGetError(error, issueNumber);
  }
}

function mapIssueGetError(error: unknown, issueNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Issue #${issueNumber} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while reading issue #${issueNumber}.`);
    }

    return new OrfeError('internal_error', `GitHub API request failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      retryable: status >= 500 || status === 429,
    });
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub issue lookup failure.');
}
