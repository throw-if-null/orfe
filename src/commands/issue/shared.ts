import type { ArtifactTemplateValidationResult } from '../../templates.js';
import { OrfeError } from '../../errors.js';
import type { GitHubClients } from '../../types.js';

export interface IssueCreateData {
  issue_number: number;
  title: string;
  state: string;
  html_url: string;
  created: true;
  project_assignment?: IssueCreateProjectAssignmentData;
}

export interface IssueCreateProjectAssignmentData {
  project_owner: string;
  project_number: number;
  project_item_id: string;
  status_field_name?: string;
  status_option_id?: string | null;
  status?: string | null;
}

export interface IssueGetData {
  issue_number: number;
  title: string;
  body: string;
  state: string;
  state_reason: string | null;
  labels: string[];
  assignees: string[];
  html_url: string;
}

export interface IssueCommentData {
  issue_number: number;
  comment_id: number;
  html_url: string;
  created: true;
}

export interface IssueUpdateData {
  issue_number: number;
  title: string;
  state: string;
  html_url: string;
  changed: boolean;
}

export type IssueValidateData = ArtifactTemplateValidationResult;

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

export interface IssueStateLookupResponse {
  repository?: {
    issue?: IssueStateNode | null;
  } | null;
}

export interface IssueStateNode {
  id?: unknown;
  number?: unknown;
  state?: unknown;
  stateReason?: unknown;
  duplicateOf?: unknown;
}

export interface ObservedIssueState {
  id: string;
  issueNumber: number;
  state: string;
  stateReason: string | null;
  duplicateOfIssueNumber: number | null;
  duplicateOfId: string | null;
}

export type IssueTargetState = 'open' | 'closed';
export type IssueTargetStateReason = 'completed' | 'not_planned' | 'duplicate';

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

    if (isObject((response.data as IssueGetResponseData).pull_request)) {
      throw new OrfeError('github_conflict', options.conflictMessage);
    }
  } catch (error) {
    throw options.mapError(error, options.issueNumber);
  }
}

export function normalizeIssueStateValue(value: string): string {
  return value.toLowerCase();
}

export function normalizeIssueStateReasonValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw new OrfeError('internal_error', 'GitHub issue state response is missing a valid stateReason value.');
  }

  const normalizedValue = value.toLowerCase().replace(/ /g, '_');
  return normalizedValue === 'reopened' ? null : normalizedValue;
}

export function normalizeLabels(value: unknown): string[] {
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

export function normalizeAssignees(value: unknown): string[] {
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

export function getGitHubRequestStatus(error: unknown): number | undefined {
  if (error instanceof Error && 'status' in error && typeof (error as { status?: unknown }).status === 'number') {
    return (error as { status: number }).status;
  }

  if (
    error instanceof Error &&
    'response' in error &&
    isObject((error as { response?: unknown }).response) &&
    typeof (error as { response: { status?: unknown } }).response.status === 'number'
  ) {
    return (error as { response: { status: number } }).response.status;
  }

  return undefined;
}

export function isObject(value: unknown): value is Record<string, unknown> {
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
