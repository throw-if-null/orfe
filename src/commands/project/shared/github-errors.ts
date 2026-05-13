import { OrfeError } from '../../../runtime/errors.js';
import type { ProjectItemType } from './lookup.js';

export function mapProjectGetStatusError(error: unknown, itemType: ProjectItemType, itemNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 401 || status === 403) {
      return new OrfeError(
        'auth_failed',
        `GitHub App authentication failed while reading project status for ${itemType === 'issue' ? 'issue' : 'pull request'} #${itemNumber}.`,
      );
    }

    return new OrfeError(
      'internal_error',
      `GitHub API request failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        retryable: status >= 500 || status === 429,
      },
    );
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub project status lookup failure.');
}

export function mapProjectSetStatusError(error: unknown, itemType: ProjectItemType, itemNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 401 || status === 403) {
      return new OrfeError(
        'auth_failed',
        `GitHub App authentication failed while setting project status for ${formatProjectTrackedItem(itemType)} #${itemNumber}.`,
      );
    }

    return new OrfeError(
      'internal_error',
      `GitHub API request failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        retryable: status >= 500 || status === 429,
      },
    );
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub project status update failure.');
}

export function mapProjectAddItemError(error: unknown, itemType: ProjectItemType, itemNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 401 || status === 403) {
      return new OrfeError(
        'auth_failed',
        `GitHub App authentication failed while adding ${formatProjectTrackedItem(itemType)} #${itemNumber} to a GitHub Project.`,
      );
    }

    return new OrfeError(
      'internal_error',
      `GitHub API request failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        retryable: status >= 500 || status === 429,
      },
    );
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub project add-item failure.');
}

export function formatProjectTrackedItem(itemType: ProjectItemType): string {
  return itemType === 'issue' ? 'issue' : 'pull request';
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
