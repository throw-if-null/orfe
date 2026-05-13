import { OrfeError } from '../../../runtime/errors.js';
import type { CommandContext } from '../../../core/context.js';
import type { CommandInput } from '../../../core/types.js';
import {
  assertIssueTargetIsIssue,
  getGitHubRequestStatus,
  normalizeIssueUpdateResponse,
  type IssueGetResponseData,
  type IssueUpdateData,
} from '../shared.js';
import { prepareIssueBodyFromInput } from '../../shared/body-input.js';

interface IssueUpdateMutation {
  title?: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export async function handleIssueUpdate(context: CommandContext<'issue update'>): Promise<IssueUpdateData> {
  const issueNumber = context.input.issue_number as number;
  const mutation = await buildIssueUpdateMutation(context);

  try {
    const { rest } = await context.getGitHubClient();
    await assertIssueTargetIsIssue({
      rest,
      owner: context.repo.owner,
      repo: context.repo.name,
      issueNumber,
      conflictMessage: `Issue #${issueNumber} is a pull request. issue update only supports issues.`,
      mapError: mapIssueUpdateError,
    });
    const response = await rest.issues.update({
      owner: context.repo.owner,
      repo: context.repo.name,
      issue_number: issueNumber,
      ...mutation,
    });

    return normalizeIssueUpdateResponse(response.data as IssueGetResponseData);
  } catch (error) {
    throw mapIssueUpdateError(error, issueNumber);
  }
}

async function buildIssueUpdateMutation(context: CommandContext<'issue update'>): Promise<IssueUpdateMutation> {
  const input = context.input as CommandInput;
  const mutation: IssueUpdateMutation = {};

  if (typeof input.title === 'string') {
    mutation.title = input.title;
  }

  const body = await prepareIssueBodyFromInput(context);

  if (typeof body === 'string') {
    mutation.body = body;
  }

  if (input.clear_labels === true) {
    mutation.labels = [];
  } else if (Array.isArray(input.labels)) {
    mutation.labels = input.labels.filter((entry): entry is string => typeof entry === 'string');
  }

  if (input.clear_assignees === true) {
    mutation.assignees = [];
  } else if (Array.isArray(input.assignees)) {
    mutation.assignees = input.assignees.filter((entry): entry is string => typeof entry === 'string');
  }

  return mutation;
}

function mapIssueUpdateError(error: unknown, issueNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Issue #${issueNumber} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while updating issue #${issueNumber}.`);
    }

    return new OrfeError('internal_error', `GitHub API request failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      retryable: status >= 500 || status === 429,
    });
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub issue update failure.');
}
