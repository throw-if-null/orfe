import type { GitHubClients } from '../../../github/types.js';
import { OrfeError } from '../../../runtime/errors.js';
import type { IssueCommentData } from '../comment/output.js';
import type { IssueCreateData, IssueCreateProjectAssignmentData } from '../create/output.js';
import type { IssueGetData } from '../get/output.js';
import type { IssueUpdateData } from '../update/output.js';

export interface IssueGetResponseData {
  number?: unknown;
  node_id?: unknown;
  title?: unknown;
  body?: unknown;
  state?: unknown;
  state_reason?: unknown;
  labels?: unknown;
  assignees?: unknown;
  html_url?: unknown;
  pull_request?: unknown;
}

export interface IssueCommentResponseData {
  id?: unknown;
  html_url?: unknown;
}

interface IssueCoreFields {
  issueNumber: number;
  title: string;
  state: string;
  htmlUrl: string;
}

export function normalizeIssueGetResponse(issue: IssueGetResponseData): IssueGetData {
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

export function normalizeIssueCreateResponse(
  issue: IssueGetResponseData,
  projectAssignment?: IssueCreateProjectAssignmentData,
): IssueCreateData {
  const coreFields = readIssueCoreFields(issue);

  return {
    issue_number: coreFields.issueNumber,
    title: coreFields.title,
    state: coreFields.state,
    html_url: coreFields.htmlUrl,
    created: true,
    ...(projectAssignment ? { project_assignment: projectAssignment } : {}),
  };
}

export function readIssueNodeId(issue: IssueGetResponseData): string {
  if (typeof issue.node_id !== 'string' || issue.node_id.length === 0) {
    throw new OrfeError('internal_error', `GitHub issue #${readIssueCoreFields(issue).issueNumber} response is missing a valid node_id.`);
  }

  return issue.node_id;
}

export function normalizeIssueUpdateResponse(issue: IssueGetResponseData): IssueUpdateData {
  const coreFields = readIssueCoreFields(issue);

  return {
    issue_number: coreFields.issueNumber,
    title: coreFields.title,
    state: coreFields.state,
    html_url: coreFields.htmlUrl,
    changed: true,
  };
}

export function normalizeIssueCommentResponse(issueNumber: number, comment: IssueCommentResponseData): IssueCommentData {
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

export function issueResponseHasPullRequest(issue: IssueGetResponseData): boolean {
  return isObject(issue.pull_request);
}

export async function assertIssueTargetIsIssue(options: {
  rest: GitHubClients['rest'];
  owner: string;
  repo: string;
  issueNumber: number;
  conflictMessage: string;
  mapError: (error: unknown, issueNumber: number) => OrfeError;
}): Promise<void> {
  try {
    const response = await options.rest.issues.get({
      owner: options.owner,
      repo: options.repo,
      issue_number: options.issueNumber,
    });

    if (issueResponseHasPullRequest(response.data as IssueGetResponseData)) {
      throw new OrfeError('github_conflict', options.conflictMessage);
    }
  } catch (error) {
    throw options.mapError(error, options.issueNumber);
  }
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
