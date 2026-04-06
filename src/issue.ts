import { OrfeError } from './errors.js';
import type { CommandContext } from './types.js';

interface IssueGetData {
  issue_number: number;
  title: string;
  body: string;
  state: string;
  state_reason: string | null;
  labels: string[];
  assignees: string[];
  html_url: string;
}

interface IssueGetResponseData {
  number?: unknown;
  title?: unknown;
  body?: unknown;
  state?: unknown;
  state_reason?: unknown;
  labels?: unknown;
  assignees?: unknown;
  html_url?: unknown;
}

export async function handleIssueGet(context: CommandContext): Promise<IssueGetData> {
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

function normalizeIssueGetResponse(issue: IssueGetResponseData): IssueGetData {
  if (typeof issue.number !== 'number' || !Number.isInteger(issue.number)) {
    throw new OrfeError('internal_error', 'GitHub issue response is missing a valid number.');
  }

  if (typeof issue.title !== 'string') {
    throw new OrfeError('internal_error', `GitHub issue #${issue.number} response is missing a valid title.`);
  }

  if (typeof issue.state !== 'string' || issue.state.length === 0) {
    throw new OrfeError('internal_error', `GitHub issue #${issue.number} response is missing a valid state.`);
  }

  if (typeof issue.html_url !== 'string' || issue.html_url.length === 0) {
    throw new OrfeError('internal_error', `GitHub issue #${issue.number} response is missing a valid html_url.`);
  }

  return {
    issue_number: issue.number,
    title: issue.title,
    body: typeof issue.body === 'string' ? issue.body : '',
    state: issue.state,
    state_reason: typeof issue.state_reason === 'string' ? issue.state_reason : null,
    labels: normalizeLabels(issue.labels),
    assignees: normalizeAssignees(issue.assignees),
    html_url: issue.html_url,
  };
}

function normalizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === 'string' && entry.length > 0) {
      return [entry];
    }

    if (isObject(entry) && typeof entry.name === 'string' && entry.name.length > 0) {
      return [entry.name];
    }

    return [];
  });
}

function normalizeAssignees(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (isObject(entry) && typeof entry.login === 'string' && entry.login.length > 0) {
      return [entry.login];
    }

    return [];
  });
}

function mapIssueGetError(error: unknown, issueNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  if (isGitHubRequestError(error)) {
    if (error.status === 404) {
      return new OrfeError('github_not_found', `Issue #${issueNumber} was not found.`);
    }

    if (error.status === 401 || error.status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while reading issue #${issueNumber}.`);
    }

    return new OrfeError('internal_error', `GitHub API request failed with status ${error.status}: ${error.message}`, {
      retryable: error.status >= 500 || error.status === 429,
    });
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub issue lookup failure.');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGitHubRequestError(error: unknown): error is Error & { status: number } {
  return error instanceof Error && 'status' in error && typeof (error as { status?: unknown }).status === 'number';
}
