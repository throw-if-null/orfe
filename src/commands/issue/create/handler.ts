import { resolveProjectCommandConfig } from '../../../config.js';
import { OrfeError } from '../../../errors.js';
import type { CommandContext, CommandInput } from '../../../types.js';
import {
  addProjectItemByContentId,
  mapProjectAddItemError,
  mapProjectSetStatusError,
  resolveProjectIdByOwnerAndNumber,
  resolveProjectStatusContext,
  selectProjectStatusOption,
  updateProjectStatus,
} from '../../project/shared.js';
import {
  getGitHubRequestStatus,
  normalizeIssueCreateResponse,
  readIssueNodeId,
  type IssueCreateData,
  type IssueCreateProjectAssignmentData,
  type IssueGetResponseData,
} from '../shared.js';
import { prepareIssueBodyFromInput } from '../../body-contract-shared.js';

interface IssueCreateMutation {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

interface IssueCreateProjectAssignmentRequest {
  projectOwner: string;
  projectNumber: number;
  statusFieldName: string;
  initialStatus: string | null;
}

export async function handleIssueCreate(context: CommandContext<'issue create'>): Promise<IssueCreateData> {
  const mutation = await buildIssueCreateMutation(context);
  const projectAssignmentRequest = resolveProjectAssignmentRequest(context);

  try {
    const { rest } = await context.getGitHubClient();
    const response = await rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.name,
      ...mutation,
    });

    const createdIssue = response.data as IssueGetResponseData;
    if (projectAssignmentRequest === null) {
      return normalizeIssueCreateResponse(createdIssue);
    }

    const projectAssignment = await applyProjectAssignment(context, createdIssue, projectAssignmentRequest);

    return normalizeIssueCreateResponse(createdIssue, projectAssignment);
  } catch (error) {
    throw mapIssueCreateError(error, context.repo.fullName);
  }
}

async function applyProjectAssignment(
  context: CommandContext<'issue create'>,
  createdIssue: IssueGetResponseData,
  projectAssignmentRequest: IssueCreateProjectAssignmentRequest,
): Promise<IssueCreateProjectAssignmentData> {
  const createdIssueSummary = normalizeIssueCreateResponse(createdIssue);
  const issueNumber = createdIssueSummary.issue_number;
  const { graphql } = await context.getGitHubClient();
  let addResult: { projectId: string; projectItemId: string };

  try {
    const projectId = await resolveProjectIdByOwnerAndNumber(
      graphql,
      projectAssignmentRequest.projectOwner,
      projectAssignmentRequest.projectNumber,
    );
    addResult = await addProjectItemByContentId(graphql, projectId, readIssueNodeId(createdIssue));
  } catch (error) {
    const mappedError = mapProjectAddItemError(error, 'issue', issueNumber);
    throw createIssueCreateProjectAssignmentError(createdIssueSummary, projectAssignmentRequest, mappedError);
  }

  if (projectAssignmentRequest.initialStatus === null) {
    return {
      project_owner: projectAssignmentRequest.projectOwner,
      project_number: projectAssignmentRequest.projectNumber,
      project_item_id: addResult.projectItemId,
    };
  }

  try {
    const currentStatusContext = await resolveProjectStatusContext(
      graphql,
      context.repo.owner,
      context.repo.name,
      projectAssignmentRequest.projectOwner,
      projectAssignmentRequest.projectNumber,
      projectAssignmentRequest.statusFieldName,
      'issue',
      issueNumber,
    );
    const targetOption = selectProjectStatusOption(
      currentStatusContext.statusField,
      projectAssignmentRequest.projectOwner,
      projectAssignmentRequest.projectNumber,
      projectAssignmentRequest.initialStatus,
    );

    if (currentStatusContext.status?.option_id !== targetOption.id) {
      await updateProjectStatus(
        graphql,
        currentStatusContext.projectId,
        currentStatusContext.projectItemId,
        currentStatusContext.statusField.id,
        targetOption.id,
      );
    }

    const observedStatusContext = await resolveProjectStatusContext(
      graphql,
      context.repo.owner,
      context.repo.name,
      projectAssignmentRequest.projectOwner,
      projectAssignmentRequest.projectNumber,
      projectAssignmentRequest.statusFieldName,
      'issue',
      issueNumber,
    );

    if (
      observedStatusContext.status === null ||
      observedStatusContext.status.option_id !== targetOption.id ||
      observedStatusContext.status.name !== targetOption.name
    ) {
      throw new OrfeError(
        'internal_error',
        `GitHub Project ${projectAssignmentRequest.projectOwner}/${projectAssignmentRequest.projectNumber} did not reach status "${projectAssignmentRequest.initialStatus}" for issue #${issueNumber}.`,
      );
    }

    return {
      project_owner: projectAssignmentRequest.projectOwner,
      project_number: projectAssignmentRequest.projectNumber,
      project_item_id: observedStatusContext.projectItemId,
      status_field_name: observedStatusContext.statusField.name,
      status_option_id: observedStatusContext.status.option_id,
      status: observedStatusContext.status.name,
    };
  } catch (error) {
    const mappedError = mapProjectSetStatusError(error, 'issue', issueNumber);
    throw createIssueCreateProjectAssignmentError(createdIssueSummary, projectAssignmentRequest, mappedError);
  }
}

async function buildIssueCreateMutation(context: CommandContext<'issue create'>): Promise<IssueCreateMutation> {
  const input = context.input as CommandInput;
  const mutation: IssueCreateMutation = {
    title: input.title as string,
  };

  const body = await prepareIssueBodyFromInput(context);

  if (typeof body === 'string') {
    mutation.body = body;
  }

  if (Array.isArray(input.labels)) {
    mutation.labels = input.labels.filter((entry): entry is string => typeof entry === 'string');
  }

  if (Array.isArray(input.assignees)) {
    mutation.assignees = input.assignees.filter((entry): entry is string => typeof entry === 'string');
  }

  return mutation;
}

function resolveProjectAssignmentRequest(
  context: CommandContext<'issue create'>,
): IssueCreateProjectAssignmentRequest | null {
  if (!isProjectAssignmentRequested(context.input)) {
    return null;
  }

  const resolvedProjectConfig = resolveProjectCommandConfig(context.repoConfig, context.input);

  return {
    projectOwner: resolvedProjectConfig.projectOwner,
    projectNumber: resolvedProjectConfig.projectNumber,
    statusFieldName: resolvedProjectConfig.statusFieldName,
    initialStatus: typeof context.input.status === 'string' ? context.input.status : null,
  };
}

function isProjectAssignmentRequested(input: CommandInput): boolean {
  return (
    input.add_to_project === true ||
    (typeof input.project_owner === 'string' && input.project_owner.trim().length > 0) ||
    typeof input.project_number === 'number' ||
    (typeof input.status_field_name === 'string' && input.status_field_name.trim().length > 0) ||
    (typeof input.status === 'string' && input.status.trim().length > 0)
  );
}

function createIssueCreateProjectAssignmentError(
  createdIssue: IssueCreateData,
  projectAssignmentRequest: IssueCreateProjectAssignmentRequest,
  cause: OrfeError,
): OrfeError {
  const projectReference = `${projectAssignmentRequest.projectOwner}/${projectAssignmentRequest.projectNumber}`;

  if (projectAssignmentRequest.initialStatus === null) {
    return new OrfeError(
      cause.code,
      `Issue #${createdIssue.issue_number} was created, but adding it to GitHub Project ${projectReference} failed: ${cause.message}`,
      {
        retryable: cause.retryable,
        details: {
          stage: 'project_add',
          created_issue: createdIssue,
          project_owner: projectAssignmentRequest.projectOwner,
          project_number: projectAssignmentRequest.projectNumber,
          ...(cause.details ? { cause: cause.details } : {}),
        },
      },
    );
  }

  return new OrfeError(
    cause.code,
    `Issue #${createdIssue.issue_number} was created and added to GitHub Project ${projectReference}, but setting initial status failed: ${cause.message}`,
    {
      retryable: cause.retryable,
      details: {
        stage: 'project_status',
        created_issue: createdIssue,
        project_owner: projectAssignmentRequest.projectOwner,
        project_number: projectAssignmentRequest.projectNumber,
        status_field_name: projectAssignmentRequest.statusFieldName,
        requested_status: projectAssignmentRequest.initialStatus,
        ...(cause.details ? { cause: cause.details } : {}),
      },
    },
  );
}

function mapIssueCreateError(error: unknown, repoFullName: string): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  const status = getGitHubRequestStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return new OrfeError('github_not_found', `Repository ${repoFullName} was not found.`);
    }

    if (status === 401 || status === 403) {
      return new OrfeError('auth_failed', `GitHub App authentication failed while creating an issue in ${repoFullName}.`);
    }

    return new OrfeError(
      'internal_error',
      `GitHub issue creation failed with status ${status}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        retryable: status >= 500 || status === 429,
      },
    );
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown GitHub issue creation failure.');
}
