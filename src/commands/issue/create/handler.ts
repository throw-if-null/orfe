import { OrfeError } from '../../../errors.js';
import type { CommandContext, CommandInput } from '../../../types.js';
import { getGitHubRequestStatus, normalizeIssueCreateResponse, type IssueCreateData, type IssueGetResponseData } from '../shared.js';

interface IssueCreateMutation {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export async function handleIssueCreate(context: CommandContext<'issue create'>): Promise<IssueCreateData> {
  const mutation = buildIssueCreateMutation(context.input);

  try {
    const { rest } = await context.getGitHubClient();
    const response = await rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.name,
      ...mutation,
    });

    return normalizeIssueCreateResponse(response.data as IssueGetResponseData);
  } catch (error) {
    throw mapIssueCreateError(error, context.repo.fullName);
  }
}

function buildIssueCreateMutation(input: CommandInput): IssueCreateMutation {
  const mutation: IssueCreateMutation = {
    title: input.title as string,
  };

  if (typeof input.body === 'string') {
    mutation.body = input.body;
  }

  if (Array.isArray(input.labels)) {
    mutation.labels = input.labels.filter((entry): entry is string => typeof entry === 'string');
  }

  if (Array.isArray(input.assignees)) {
    mutation.assignees = input.assignees.filter((entry): entry is string => typeof entry === 'string');
  }

  return mutation;
}

function mapIssueCreateError(error: unknown, repoFullName: string): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Repository ${repoFullName} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while creating an issue in ${repoFullName}.`);
    }

    return new OrfeError(
      'internal_error',
      `GitHub issue creation failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        retryable: status >= 500 || status === 429,
      },
    );
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub issue creation failure.');
}
