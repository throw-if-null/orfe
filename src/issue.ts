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

interface IssueSetStateData {
  issue_number: number;
  state: string;
  state_reason: string | null;
  duplicate_of_issue_number: number | null;
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

interface IssueStateLookupResponse {
  repository?: {
    issue?: IssueStateNode | null;
  } | null;
}

interface IssueStateNode {
  id?: unknown;
  number?: unknown;
  state?: unknown;
  stateReason?: unknown;
  duplicateOf?: unknown;
}

interface ObservedIssueState {
  id: string;
  issueNumber: number;
  state: string;
  stateReason: string | null;
  duplicateOfIssueNumber: number | null;
  duplicateOfId: string | null;
}

type IssueTargetState = 'open' | 'closed';
type IssueTargetStateReason = 'completed' | 'not_planned' | 'duplicate';

const ISSUE_STATE_LOOKUP_QUERY = `
  query IssueStateByNumber($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        id
        number
        state
        stateReason
        duplicateOf {
          id
          number
        }
      }
    }
  }
`;

const MARK_ISSUE_AS_DUPLICATE_MUTATION = `
  mutation MarkIssueAsDuplicate($duplicateId: ID!, $canonicalId: ID!) {
    markIssueAsDuplicate(input: { duplicateId: $duplicateId, canonicalId: $canonicalId }) {
      clientMutationId
    }
  }
`;

const UNMARK_ISSUE_AS_DUPLICATE_MUTATION = `
  mutation UnmarkIssueAsDuplicate($duplicateId: ID!, $canonicalId: ID!) {
    unmarkIssueAsDuplicate(input: { duplicateId: $duplicateId, canonicalId: $canonicalId }) {
      clientMutationId
    }
  }
`;

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
    await assertIssueUpdateTargetIsIssue(rest, context.repo.owner, context.repo.name, issueNumber);
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

export async function handleIssueSetState(context: CommandContext): Promise<IssueSetStateData> {
  const issueNumber = context.input.issue_number as number;
  const targetState = context.input.state as IssueTargetState;
  const targetStateReason = (context.input.state_reason as IssueTargetStateReason | undefined) ?? undefined;
  const duplicateOfIssueNumber = (context.input.duplicate_of as number | undefined) ?? undefined;

  try {
    const { rest, graphql } = await context.getGitHubClient();
    await assertIssueSetStateTargetIsIssue(rest, context.repo.owner, context.repo.name, issueNumber);

    if (targetState === 'closed' && targetStateReason === 'duplicate' && duplicateOfIssueNumber !== undefined) {
      return await closeIssueAsDuplicate({
        graphql,
        rest,
        owner: context.repo.owner,
        repo: context.repo.name,
        issueNumber,
        duplicateOfIssueNumber,
      });
    }

    return await setIssueStateWithoutDuplicate({
      graphql,
      rest,
      owner: context.repo.owner,
      repo: context.repo.name,
      issueNumber,
      targetState,
      ...(targetStateReason !== undefined ? { targetStateReason } : {}),
    });
  } catch (error) {
    throw mapIssueSetStateError(error, issueNumber);
  }
}

async function assertIssueUpdateTargetIsIssue(
  rest: GitHubClients['rest'],
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<void> {
  await assertIssueTargetIsIssue(
    rest,
    owner,
    repo,
    issueNumber,
    `Issue #${issueNumber} is a pull request. issue.update only supports issues.`,
    mapIssueUpdateError,
  );
}

async function assertIssueCommentTargetIsIssue(
  rest: GitHubClients['rest'],
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<void> {
  await assertIssueTargetIsIssue(
    rest,
    owner,
    repo,
    issueNumber,
    `Issue #${issueNumber} is a pull request. Use pr.comment instead.`,
    mapIssueCommentError,
  );
}

async function assertIssueSetStateTargetIsIssue(
  rest: GitHubClients['rest'],
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<void> {
  await assertIssueTargetIsIssue(
    rest,
    owner,
    repo,
    issueNumber,
    `Issue #${issueNumber} is a pull request. issue.set-state only supports issues.`,
    mapIssueSetStateError,
  );
}

async function assertIssueTargetIsIssue(
  rest: GitHubClients['rest'],
  owner: string,
  repo: string,
  issueNumber: number,
  conflictMessage: string,
  mapError: (error: unknown, issueNumber: number) => OrfeError,
): Promise<void> {
  try {
    const response = await rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    if (isObject((response.data as IssueGetResponseData).pull_request)) {
      throw new OrfeError('github_conflict', conflictMessage);
    }
  } catch (error) {
    throw mapError(error, issueNumber);
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

function normalizeIssueSetStateResult(issue: ObservedIssueState, changed: boolean): IssueSetStateData {
  return {
    issue_number: issue.issueNumber,
    state: issue.state,
    state_reason: issue.stateReason,
    duplicate_of_issue_number: issue.duplicateOfIssueNumber,
    changed,
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

async function setIssueStateWithoutDuplicate(options: {
  graphql: GitHubClients['graphql'];
  rest: GitHubClients['rest'];
  owner: string;
  repo: string;
  issueNumber: number;
  targetState: IssueTargetState;
  targetStateReason?: IssueTargetStateReason;
}): Promise<IssueSetStateData> {
  const currentIssue = await lookupObservedIssueState(options.graphql, options.owner, options.repo, options.issueNumber);

  if (matchesNonDuplicateStateTarget(currentIssue, options.targetState, options.targetStateReason)) {
    return normalizeIssueSetStateResult(currentIssue, false);
  }

  if (currentIssue.duplicateOfId !== null) {
    await unmarkIssueAsDuplicate(options.graphql, currentIssue.id, currentIssue.duplicateOfId);
  }

  await options.rest.issues.update(buildIssueStateRestUpdateRequest(options));

  const observedIssue = await lookupObservedIssueState(options.graphql, options.owner, options.repo, options.issueNumber);
  assertObservedNonDuplicateState(observedIssue, options.issueNumber, options.targetState, options.targetStateReason);

  return normalizeIssueSetStateResult(observedIssue, true);
}

async function closeIssueAsDuplicate(options: {
  graphql: GitHubClients['graphql'];
  rest: GitHubClients['rest'];
  owner: string;
  repo: string;
  issueNumber: number;
  duplicateOfIssueNumber: number;
}): Promise<IssueSetStateData> {
  const currentIssue = await lookupObservedIssueState(options.graphql, options.owner, options.repo, options.issueNumber);
  const canonicalIssue = await lookupObservedIssueStateAllowNotFound(
    options.graphql,
    options.owner,
    options.repo,
    options.duplicateOfIssueNumber,
  );

  if (canonicalIssue === null) {
    throw new OrfeError('github_not_found', `Duplicate target issue #${options.duplicateOfIssueNumber} was not found.`);
  }

  if (
    currentIssue.state === 'closed' &&
    currentIssue.stateReason === 'duplicate' &&
    currentIssue.duplicateOfIssueNumber === canonicalIssue.issueNumber
  ) {
    return normalizeIssueSetStateResult(currentIssue, false);
  }

  if (currentIssue.duplicateOfId !== null && currentIssue.duplicateOfId !== canonicalIssue.id) {
    await unmarkIssueAsDuplicate(options.graphql, currentIssue.id, currentIssue.duplicateOfId);
  }

  if (currentIssue.duplicateOfIssueNumber !== canonicalIssue.issueNumber) {
    await markIssueAsDuplicate(options.graphql, currentIssue.id, canonicalIssue.id);
  }

  let observedIssue = await lookupObservedIssueState(options.graphql, options.owner, options.repo, options.issueNumber);

  if (!matchesDuplicateStateTarget(observedIssue, canonicalIssue.issueNumber)) {
    await options.rest.issues.update(buildIssueStateRestUpdateRequest({
      owner: options.owner,
      repo: options.repo,
      issueNumber: options.issueNumber,
      targetState: 'closed',
      targetStateReason: 'duplicate',
    }));

    observedIssue = await lookupObservedIssueState(options.graphql, options.owner, options.repo, options.issueNumber);
  }

  if (!matchesDuplicateStateTarget(observedIssue, canonicalIssue.issueNumber)) {
    throw new OrfeError(
      'internal_error',
      `Issue #${options.issueNumber} did not reach the requested duplicate state for canonical issue #${canonicalIssue.issueNumber}.`,
    );
  }

  return normalizeIssueSetStateResult(observedIssue, true);
}

async function lookupObservedIssueState(
  graphql: GitHubClients['graphql'],
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<ObservedIssueState> {
  const response = await graphql<IssueStateLookupResponse>(ISSUE_STATE_LOOKUP_QUERY, {
    owner,
    repo,
    issueNumber,
  });

  const issueNode = response.repository?.issue;
  if (issueNode === null || issueNode === undefined) {
    throw new OrfeError('github_not_found', `Issue #${issueNumber} was not found.`);
  }

  return normalizeObservedIssueState(issueNode, issueNumber);
}

async function lookupObservedIssueStateAllowNotFound(
  graphql: GitHubClients['graphql'],
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<ObservedIssueState | null> {
  const response = await graphql<IssueStateLookupResponse>(ISSUE_STATE_LOOKUP_QUERY, {
    owner,
    repo,
    issueNumber,
  });

  const issueNode = response.repository?.issue;
  if (issueNode === null || issueNode === undefined) {
    return null;
  }

  return normalizeObservedIssueState(issueNode, issueNumber);
}

function normalizeObservedIssueState(issue: IssueStateNode, issueNumber: number): ObservedIssueState {
  if (typeof issue.id !== 'string' || issue.id.length === 0) {
    throw new OrfeError('internal_error', `GitHub issue state response for issue #${issueNumber} is missing a valid id.`);
  }

  if (typeof issue.number !== 'number' || !Number.isInteger(issue.number)) {
    throw new OrfeError('internal_error', `GitHub issue state response for issue #${issueNumber} is missing a valid number.`);
  }

  if (typeof issue.state !== 'string' || issue.state.length === 0) {
    throw new OrfeError('internal_error', `GitHub issue state response for issue #${issueNumber} is missing a valid state.`);
  }

  const duplicateOf = issue.duplicateOf;
  const duplicateOfIssueNumber = readDuplicateIssueNumber(duplicateOf, issueNumber);
  const duplicateOfId = readDuplicateIssueId(duplicateOf, issueNumber);

  return {
    id: issue.id,
    issueNumber: issue.number,
    state: normalizeIssueStateValue(issue.state),
    stateReason: normalizeIssueStateReasonValue(issue.stateReason),
    duplicateOfIssueNumber,
    duplicateOfId,
  };
}

function readDuplicateIssueNumber(value: unknown, issueNumber: number): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isObject(value) || typeof value.number !== 'number' || !Number.isInteger(value.number)) {
    throw new OrfeError(
      'internal_error',
      `GitHub issue state response for issue #${issueNumber} is missing a valid duplicateOf.number value.`,
    );
  }

  return value.number;
}

function readDuplicateIssueId(value: unknown, issueNumber: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isObject(value) || typeof value.id !== 'string' || value.id.length === 0) {
    throw new OrfeError(
      'internal_error',
      `GitHub issue state response for issue #${issueNumber} is missing a valid duplicateOf.id value.`,
    );
  }

  return value.id;
}

function normalizeIssueStateValue(value: string): string {
  return value.toLowerCase();
}

function normalizeIssueStateReasonValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw new OrfeError('internal_error', 'GitHub issue state response is missing a valid stateReason value.');
  }

  const normalizedValue = value.toLowerCase().replace(/ /g, '_');
  return normalizedValue === 'reopened' ? null : normalizedValue;
}

function buildIssueStateRestUpdateRequest(options: {
  owner: string;
  repo: string;
  issueNumber: number;
  targetState: IssueTargetState;
  targetStateReason?: IssueTargetStateReason;
}): Parameters<GitHubClients['rest']['issues']['update']>[0] {
  if (options.targetStateReason === 'duplicate') {
    return {
      owner: options.owner,
      repo: options.repo,
      issue_number: options.issueNumber,
      state: options.targetState,
      state_reason: 'duplicate',
    } as unknown as Parameters<GitHubClients['rest']['issues']['update']>[0];
  }

  return {
    owner: options.owner,
    repo: options.repo,
    issue_number: options.issueNumber,
    state: options.targetState,
    ...(options.targetState === 'closed' && options.targetStateReason !== undefined
      ? { state_reason: options.targetStateReason }
      : {}),
  };
}

function matchesNonDuplicateStateTarget(
  issue: ObservedIssueState,
  targetState: IssueTargetState,
  targetStateReason?: IssueTargetStateReason,
): boolean {
  if (issue.duplicateOfIssueNumber !== null || issue.state !== targetState) {
    return false;
  }

  if (targetState === 'open') {
    return issue.stateReason === null;
  }

  if (targetStateReason === undefined) {
    return true;
  }

  return issue.stateReason === targetStateReason;
}

function matchesDuplicateStateTarget(issue: ObservedIssueState, canonicalIssueNumber: number): boolean {
  return issue.state === 'closed' && issue.stateReason === 'duplicate' && issue.duplicateOfIssueNumber === canonicalIssueNumber;
}

function assertObservedNonDuplicateState(
  issue: ObservedIssueState,
  issueNumber: number,
  targetState: IssueTargetState,
  targetStateReason?: IssueTargetStateReason,
): void {
  if (issue.duplicateOfIssueNumber !== null) {
    throw new OrfeError(
      'internal_error',
      `Issue #${issueNumber} still has duplicate_of issue #${issue.duplicateOfIssueNumber} after the state update.`,
    );
  }

  if (issue.state !== targetState) {
    throw new OrfeError('internal_error', `Issue #${issueNumber} did not reach state "${targetState}".`);
  }

  if (targetState === 'open' && issue.stateReason !== null) {
    throw new OrfeError('internal_error', `Issue #${issueNumber} should not have a close reason after reopening.`);
  }

  if (targetState === 'closed' && targetStateReason !== undefined && issue.stateReason !== targetStateReason) {
    throw new OrfeError(
      'internal_error',
      `Issue #${issueNumber} did not reach state_reason "${targetStateReason}" after closing.`,
    );
  }
}

async function markIssueAsDuplicate(
  graphql: GitHubClients['graphql'],
  duplicateId: string,
  canonicalId: string,
): Promise<void> {
  await graphql(MARK_ISSUE_AS_DUPLICATE_MUTATION, {
    duplicateId,
    canonicalId,
  });
}

async function unmarkIssueAsDuplicate(
  graphql: GitHubClients['graphql'],
  duplicateId: string,
  canonicalId: string,
): Promise<void> {
  await graphql(UNMARK_ISSUE_AS_DUPLICATE_MUTATION, {
    duplicateId,
    canonicalId,
  });
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

function mapIssueSetStateError(error: unknown, issueNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Issue #${issueNumber} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while setting state for issue #${issueNumber}.`);
    }

    return new OrfeError('internal_error', `GitHub API request failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      retryable: status >= 500 || status === 429,
    });
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub issue state update failure.');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getGitHubRequestStatus(error: unknown): number | undefined {
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
