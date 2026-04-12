import { OrfeError } from './errors.js';
import type { CommandContext } from './types.js';

interface PullRequestCommentData {
  pr_number: number;
  comment_id: number;
  html_url: string;
  created: true;
}

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

interface PullRequestGetOrCreateData {
  pr_number: number;
  html_url: string;
  head: string;
  base: string;
  draft: boolean;
  created: boolean;
}

interface PullRequestSummaryData {
  pr_number: number;
  draft: boolean;
  head: string;
  base: string;
  html_url: string;
}

interface PullRequestRefData {
  ref?: unknown;
}

interface PullRequestCommentResponseData {
  id?: unknown;
  html_url?: unknown;
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

export async function handlePrComment(context: CommandContext): Promise<PullRequestCommentData> {
  const prNumber = context.input.pr_number as number;
  const body = context.input.body as string;

  try {
    const { rest } = await context.getGitHubClient();
    const response = await rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.name,
      issue_number: prNumber,
      body,
    });

    return normalizePullRequestCommentResponse(prNumber, response.data as PullRequestCommentResponseData);
  } catch (error) {
    throw mapPullRequestCommentError(error, prNumber);
  }
}

export async function handlePrGetOrCreate(context: CommandContext): Promise<PullRequestGetOrCreateData> {
  const head = context.input.head as string;
  const base = (context.input.base as string | undefined) ?? context.repoConfig.repository.defaultBranch;
  const title = context.input.title as string;
  const body = context.input.body as string | undefined;
  const draft = context.input.draft === true;

  let existingPullRequests: PullRequestSummaryData[];

  try {
    const { rest } = await context.getGitHubClient();
    const response = await rest.pulls.list({
      owner: context.repo.owner,
      repo: context.repo.name,
      state: 'open',
      head: `${context.repo.owner}:${head}`,
      base,
      per_page: 100,
    });

    existingPullRequests = (response.data as PullRequestGetResponseData[])
      .map((pullRequest) => normalizePullRequestSummaryResponse(pullRequest))
      .filter((pullRequest) => pullRequest.head === head && pullRequest.base === base);
  } catch (error) {
    throw mapPullRequestLookupError(error, context.repo.fullName, head, base);
  }

  if (existingPullRequests.length > 1) {
    throw new OrfeError(
      'github_conflict',
      `Found ${existingPullRequests.length} open pull requests for head "${head}" and base "${base}" in ${context.repo.fullName}.`,
    );
  }

  const existingPullRequest = existingPullRequests[0];
  if (existingPullRequest) {
    return {
      pr_number: existingPullRequest.pr_number,
      html_url: existingPullRequest.html_url,
      head: existingPullRequest.head,
      base: existingPullRequest.base,
      draft: existingPullRequest.draft,
      created: false,
    };
  }

  try {
    const { rest } = await context.getGitHubClient();
    const response = await rest.pulls.create({
      owner: context.repo.owner,
      repo: context.repo.name,
      head,
      base,
      title,
      ...(body !== undefined ? { body } : {}),
      draft,
    });
    const createdPullRequest = normalizePullRequestSummaryResponse(response.data as PullRequestGetResponseData);

    return {
      pr_number: createdPullRequest.pr_number,
      html_url: createdPullRequest.html_url,
      head: createdPullRequest.head,
      base: createdPullRequest.base,
      draft: createdPullRequest.draft,
      created: true,
    };
  } catch (error) {
    throw mapPullRequestCreateError(error, context.repo.fullName, head, base);
  }
}

function normalizePullRequestCommentResponse(
  prNumber: number,
  comment: PullRequestCommentResponseData,
): PullRequestCommentData {
  if (typeof comment.id !== 'number' || !Number.isInteger(comment.id)) {
    throw new OrfeError('internal_error', `GitHub comment response for pull request #${prNumber} is missing a valid id.`);
  }

  if (typeof comment.html_url !== 'string' || comment.html_url.length === 0) {
    throw new OrfeError('internal_error', `GitHub comment response for pull request #${prNumber} is missing a valid html_url.`);
  }

  return {
    pr_number: prNumber,
    comment_id: comment.id,
    html_url: comment.html_url,
    created: true,
  };
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
    title: pullRequest.title,
    body: typeof pullRequest.body === 'string' ? pullRequest.body : '',
    state: pullRequest.state,
    ...normalizePullRequestSummaryResponse(pullRequest),
  };
}

function normalizePullRequestSummaryResponse(pullRequest: PullRequestGetResponseData): PullRequestSummaryData {
  const prNumber = readPullRequestNumber(pullRequest);

  if (typeof pullRequest.draft !== 'boolean') {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid draft flag.`);
  }

  if (typeof pullRequest.html_url !== 'string' || pullRequest.html_url.length === 0) {
    throw new OrfeError('internal_error', `GitHub pull request #${prNumber} response is missing a valid html_url.`);
  }

  return {
    pr_number: prNumber,
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

function mapPullRequestCommentError(error: unknown, prNumber: number): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Pull request #${prNumber} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while commenting on pull request #${prNumber}.`);
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

  return new OrfeError('internal_error', 'Unknown GitHub pull request comment failure.');
}

function mapPullRequestLookupError(error: unknown, repoFullName: string, head: string, base: string): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Repository ${repoFullName} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError(
        'auth_failed',
        `GitHub App authentication failed while looking up pull requests for head "${head}" and base "${base}".`,
      );
    }

    return new OrfeError(
      'internal_error',
      `GitHub pull request lookup failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

function mapPullRequestCreateError(error: unknown, repoFullName: string, head: string, base: string): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Repository ${repoFullName} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError(
        'auth_failed',
        `GitHub App authentication failed while creating a pull request for head "${head}" and base "${base}".`,
      );
    }

    return new OrfeError(
      'internal_error',
      `GitHub pull request creation failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        retryable: status >= 500 || status === 429,
      },
    );
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub pull request creation failure.');
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
