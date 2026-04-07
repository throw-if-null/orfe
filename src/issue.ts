import { OrfeError } from './errors.js';
import type { CommandContext, CommandInput, GitHubClients } from './types.js';

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

interface IssueCommentData {
  issue_number: number;
  comment_id: number;
  html_url: string;
  created: true;
}

interface IssueUpdateData {
  issue_number: number;
  title: string;
  state: string;
  html_url: string;
  changed: boolean;
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
  pull_request?: unknown;
}

interface IssueCommentResponseData {
  id?: unknown;
  html_url?: unknown;
}

interface IssueUpdateMutation {
  title?: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

interface IssueCoreFields {
  issueNumber: number;
  title: string;
  state: string;
  htmlUrl: string;
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

export async function handleIssueUpdate(context: CommandContext): Promise<IssueUpdateData> {
  const issueNumber = context.input.issue_number as number;
  const mutation = buildIssueUpdateMutation(context.input);

  try {
    const { rest } = await context.getGitHubClient();
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

export async function handleIssueComment(context: CommandContext): Promise<IssueCommentData> {
  const issueNumber = context.input.issue_number as number;
  const body = context.input.body as string;

  try {
    const { rest } = await context.getGitHubClient();
    await assertIssueCommentTargetIsIssue(rest, context.repo.owner, context.repo.name, issueNumber);
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

async function assertIssueCommentTargetIsIssue(
  rest: GitHubClients['rest'],
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<void> {
  try {
    const response = await rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    if (isObject((response.data as IssueGetResponseData).pull_request)) {
      throw new OrfeError('github_conflict', `Issue #${issueNumber} is a pull request. Use pr.comment instead.`);
    }
  } catch (error) {
    throw mapIssueCommentError(error, issueNumber);
  }
}

function normalizeIssueGetResponse(issue: IssueGetResponseData): IssueGetData {
  const coreFields = readIssueCoreFields(issue);

  return {
    issue_number: coreFields.issueNumber,
    title: coreFields.title,
    body: typeof issue.body === 'string' ? issue.body : '',
    state: coreFields.state,
    state_reason: typeof issue.state_reason === 'string' ? issue.state_reason : null,
    labels: normalizeLabels(issue.labels),
    assignees: normalizeAssignees(issue.assignees),
    html_url: coreFields.htmlUrl,
  };
}

function normalizeIssueUpdateResponse(issue: IssueGetResponseData): IssueUpdateData {
  const coreFields = readIssueCoreFields(issue);

  return {
    issue_number: coreFields.issueNumber,
    title: coreFields.title,
    state: coreFields.state,
    html_url: coreFields.htmlUrl,
    changed: true,
  };
}

function normalizeIssueCommentResponse(issueNumber: number, comment: IssueCommentResponseData): IssueCommentData {
  if (typeof comment.id !== 'number' || !Number.isInteger(comment.id)) {
    throw new OrfeError('internal_error', `GitHub comment response for issue #${issueNumber} is missing a valid id.`);
  }

  if (typeof comment.html_url !== 'string' || comment.html_url.length === 0) {
    throw new OrfeError('internal_error', `GitHub comment response for issue #${issueNumber} is missing a valid html_url.`);
  }

  return {
    issue_number: issueNumber,
    comment_id: comment.id,
    html_url: comment.html_url,
    created: true,
  };
}

function readIssueCoreFields(issue: IssueGetResponseData): IssueCoreFields {
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
    issueNumber: issue.number,
    title: issue.title,
    state: issue.state,
    htmlUrl: issue.html_url,
  };
}

function buildIssueUpdateMutation(input: CommandInput): IssueUpdateMutation {
  const mutation: IssueUpdateMutation = {};

  if (typeof input.title === 'string') {
    mutation.title = input.title;
  }

  if (typeof input.body === 'string') {
    mutation.body = input.body;
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

function mapIssueCommentError(error: unknown, issueNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  if (isGitHubRequestError(error)) {
    if (error.status === 404) {
      return new OrfeError('github_not_found', `Issue #${issueNumber} was not found.`);
    }

    if (error.status === 401 || error.status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while commenting on issue #${issueNumber}.`);
    }

    return new OrfeError('internal_error', `GitHub API request failed with status ${error.status}: ${error.message}`, {
      retryable: error.status >= 500 || error.status === 429,
    });
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub issue comment failure.');
}

function mapIssueUpdateError(error: unknown, issueNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  if (isGitHubRequestError(error)) {
    if (error.status === 404) {
      return new OrfeError('github_not_found', `Issue #${issueNumber} was not found.`);
    }

    if (error.status === 401 || error.status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while updating issue #${issueNumber}.`);
    }

    return new OrfeError('internal_error', `GitHub API request failed with status ${error.status}: ${error.message}`, {
      retryable: error.status >= 500 || error.status === 429,
    });
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub issue update failure.');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGitHubRequestError(error: unknown): error is Error & { status: number } {
  return error instanceof Error && 'status' in error && typeof (error as { status?: unknown }).status === 'number';
}
