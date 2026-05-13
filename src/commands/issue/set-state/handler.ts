import { OrfeError } from '../../../runtime/errors.js';
import type { CommandContext } from '../../../core/context.js';
import type { GitHubClients } from '../../../github/types.js';
import {
  assertIssueTargetIsIssue,
  type IssueGetResponseData,
  issueResponseHasPullRequest,
} from '../shared/github-response.js';
import { getGitHubRequestStatus } from '../shared/github-errors.js';
import {
  normalizeObservedIssueState,
  type IssueStateLookupResponse,
  type IssueTargetState,
  type IssueTargetStateReason,
  type ObservedIssueState,
} from '../shared/state.js';

export interface IssueSetStateData {
  issue_number: number;
  state: string;
  state_reason: string | null;
  duplicate_of_issue_number: number | null;
  changed: boolean;
}

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

export async function handleIssueSetState(context: CommandContext<'issue set-state'>): Promise<IssueSetStateData> {
  const issueNumber = context.input.issue_number as number;
  const targetState = context.input.state as IssueTargetState;
  const targetStateReason = (context.input.state_reason as IssueTargetStateReason | undefined) ?? undefined;
  const duplicateOfIssueNumber = (context.input.duplicate_of as number | undefined) ?? undefined;

  try {
    const { rest, graphql } = await context.getGitHubClient();
    await assertIssueTargetIsIssue({
      rest,
      owner: context.repo.owner,
      repo: context.repo.name,
      issueNumber,
      conflictMessage: `Issue #${issueNumber} is a pull request. issue set-state only supports issues.`,
      mapError: mapIssueSetStateError,
    });

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

function normalizeIssueSetStateResult(issue: ObservedIssueState, changed: boolean): IssueSetStateData {
  return {
    issue_number: issue.issueNumber,
    state: issue.state,
    state_reason: issue.stateReason,
    duplicate_of_issue_number: issue.duplicateOfIssueNumber,
    changed,
  };
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
  const canonicalIssue = await resolveCanonicalDuplicateIssue(options);

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

async function resolveCanonicalDuplicateIssue(options: {
  graphql: GitHubClients['graphql'];
  rest: GitHubClients['rest'];
  owner: string;
  repo: string;
  issueNumber: number;
  duplicateOfIssueNumber: number;
}): Promise<ObservedIssueState> {
  const canonicalIssue = await lookupObservedIssueStateAllowNotFound(
    options.graphql,
    options.owner,
    options.repo,
    options.duplicateOfIssueNumber,
  );

  if (canonicalIssue !== null) {
    return canonicalIssue;
  }

  try {
    const response = await options.rest.issues.get({
      owner: options.owner,
      repo: options.repo,
      issue_number: options.duplicateOfIssueNumber,
    });

    if (issueResponseHasPullRequest(response.data as IssueGetResponseData)) {
      throw new OrfeError(
        'github_conflict',
        `Duplicate target issue #${options.duplicateOfIssueNumber} is a pull request. --duplicate-of must reference an issue.`,
      );
    }
  } catch (error) {
    if (error instanceof OrfeError) {
      throw error;
    }

    const status = getGitHubRequestStatus(error);
    if (status === 404) {
      throw new OrfeError('github_not_found', `Duplicate target issue #${options.duplicateOfIssueNumber} was not found.`);
    }

    throw mapIssueSetStateError(error, options.issueNumber);
  }

  throw new OrfeError(
    'internal_error',
    `Duplicate target issue #${options.duplicateOfIssueNumber} exists but could not be resolved as an issue via GraphQL.`,
  );
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
