import { OrfeError } from './errors.js';
import type { CommandContext } from './types.js';

interface PullRequestGetData {
  pr_number: number;
  title: string;
  body: string;
  state: string;
  draft: boolean;
  head: string;
  base: string;
  html_url: string;
}

interface PullRequestRefData {
  ref?: unknown;
}

interface PullRequestGetResponseData {
  number?: unknown;
  title?: unknown;
  body?: unknown;
  state?: unknown;
  draft?: unknown;
  head?: unknown;
  base?: unknown;
  html_url?: unknown;
}

export async function handlePrGet(context: CommandContext): Promise<PullRequestGetData> {
  const prNumber = context.input.pr_number as number;

  try {
    const { rest } = await context.getGitHubClient();
    const response = await rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.name,
      pull_number: prNumber,
    });

    return normalizePullRequestGetResponse(response.data as PullRequestGetResponseData);
  } catch (error) {
    throw mapPullRequestGetError(error, prNumber);
  }
}

function normalizePullRequestGetResponse(pullRequest: PullRequestGetResponseData): PullRequestGetData {
  const prNumber = readPullRequestNumber(pullRequest);

  if (typeof pullRequest.title !== 'string') {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid title.`);
  }

  if (typeof pullRequest.state !== 'string' || pullRequest.state.length === 0) {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid state.`);
  }

  if (typeof pullRequest.draft !== 'boolean') {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid draft flag.`);
  }

  if (typeof pullRequest.html_url !== 'string' || pullRequest.html_url.length === 0) {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid html_url.`);
  }

  return {
    pr_number: prNumber,
    title: pullRequest.title,
    body: typeof pullRequest.body === 'string' ? pullRequest.body : '',
    state: pullRequest.state,
    draft: pullRequest.draft,
    head: readPullRequestRef(pullRequest.head, prNumber, 'head'),
    base: readPullRequestRef(pullRequest.base, prNumber, 'base'),
    html_url: pullRequest.html_url,
  };
}

function readPullRequestNumber(pullRequest: PullRequestGetResponseData): number {
  if (typeof pullRequest.number !== 'number' || !Number.isInteger(pullRequest.number)) {
    throw new OrfeError('internal_error', 'GitHub pull request response is missing a valid number.');
  }

  return pullRequest.number;
}

function readPullRequestRef(value: unknown, prNumber: number, label: 'head' | 'base'): string {
  if (!isObject(value)) {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid ${label} object.`);
  }

  const ref = (value as PullRequestRefData).ref;
  if (typeof ref !== 'string' || ref.length === 0) {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid ${label}.ref value.`);
  }

  return ref;
}

function mapPullRequestGetError(error: unknown, prNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Pull request #${prNumber} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while reading pull request #${prNumber}.`);
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

  return new OrfeError('internal_error', 'Unknown GitHub pull request lookup failure.');
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
