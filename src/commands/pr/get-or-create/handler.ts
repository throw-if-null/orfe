import { OrfeError } from '../../../errors.js';
import type { CommandContext } from '../../../types.js';
import {
  getGitHubRequestStatus,
  normalizePullRequestSummaryResponse,
  type PullRequestGetOrCreateData,
  type PullRequestGetResponseData,
  type PullRequestSummaryData,
} from '../shared.js';
import { preparePullRequestBodyFromInput } from '../../shared/body-input.js';

export async function handlePrGetOrCreate(context: CommandContext<'pr get-or-create'>): Promise<PullRequestGetOrCreateData> {
  const head = context.input.head as string;
  const base = (context.input.base as string | undefined) ?? context.repoConfig.repository.defaultBranch;
  const title = context.input.title as string;
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

  const body = await preparePullRequestBodyFromInput(context);

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
