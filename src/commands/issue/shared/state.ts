import { OrfeError } from '../../../runtime/errors.js';

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

export function normalizeObservedIssueState(issue: IssueStateNode, issueNumber: number): ObservedIssueState {
  if (typeof issue.id !== 'string' || issue.id.length === 0) {
    throw new OrfeError('internal_error', `GitHub issue state response for issue #${issueNumber} is missing a valid id.`);
  }

  if (typeof issue.number !== 'number' || !Number.isInteger(issue.number)) {
    throw new OrfeError('internal_error', `GitHub issue state response for issue #${issueNumber} is missing a valid number.`);
  }

  if (typeof issue.state !== 'string' || issue.state.length === 0) {
    throw new OrfeError('internal_error', `GitHub issue state response for issue #${issueNumber} is missing a valid state.`);
  }

  return {
    id: issue.id,
    issueNumber: issue.number,
    state: normalizeIssueStateValue(issue.state),
    stateReason: normalizeIssueStateReasonValue(issue.stateReason),
    duplicateOfIssueNumber: readDuplicateIssueNumber(issue.duplicateOf, issueNumber),
    duplicateOfId: readDuplicateIssueId(issue.duplicateOf, issueNumber),
  };
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
