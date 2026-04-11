import { resolveProjectCommandConfig } from './config.js';
import { OrfeError } from './errors.js';
import type { CommandContext } from './types.js';

type ProjectItemType = 'issue' | 'pr';

interface ProjectGetStatusData {
  project_owner: string;
  project_number: number;
  status_field_name: string;
  status_field_id: string;
  item_type: ProjectItemType;
  item_number: number;
  project_item_id: string;
  status_option_id: string | null;
  status: string | null;
}

interface ProjectStatusLookupResponse {
  repository?: {
    issue?: ProjectTrackedNode | null;
    pullRequest?: ProjectTrackedNode | null;
  } | null;
}

interface ProjectTrackedNode {
  projectItems?: {
    nodes?: unknown;
  } | null;
}

interface ProjectItemNode {
  id?: unknown;
  project?: unknown;
  fieldValueByName?: unknown;
}

interface ProjectNode {
  number?: unknown;
  owner?: unknown;
  fields?: unknown;
}

interface ProjectOwnerNode {
  login?: unknown;
}

interface ProjectFieldsConnection {
  nodes?: unknown;
}

interface ProjectSingleSelectFieldNode {
  __typename?: unknown;
  id?: unknown;
  name?: unknown;
}

interface ProjectSingleSelectFieldValueNode {
  __typename?: unknown;
  name?: unknown;
  optionId?: unknown;
  field?: unknown;
}

interface ProjectStatusField {
  id: string;
  name: string;
}

interface ProjectStatusValue {
  option_id: string;
  name: string;
}

const PROJECT_STATUS_FOR_ISSUE_QUERY = `
  query ProjectStatusForIssue($owner: String!, $repo: String!, $itemNumber: Int!, $statusFieldName: String!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $itemNumber) {
        projectItems(first: 100) {
          nodes {
            id
            project {
              number
              owner {
                ... on Organization {
                  login
                }
                ... on User {
                  login
                }
              }
              fields(first: 100) {
                nodes {
                  __typename
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                  }
                }
              }
            }
            fieldValueByName(name: $statusFieldName) {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                optionId
                field {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const PROJECT_STATUS_FOR_PULL_REQUEST_QUERY = `
  query ProjectStatusForPullRequest($owner: String!, $repo: String!, $itemNumber: Int!, $statusFieldName: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $itemNumber) {
        projectItems(first: 100) {
          nodes {
            id
            project {
              number
              owner {
                ... on Organization {
                  login
                }
                ... on User {
                  login
                }
              }
              fields(first: 100) {
                nodes {
                  __typename
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                  }
                }
              }
            }
            fieldValueByName(name: $statusFieldName) {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                optionId
                field {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function handleProjectGetStatus(context: CommandContext): Promise<ProjectGetStatusData> {
  const itemType = context.input.item_type as ProjectItemType;
  const itemNumber = context.input.item_number as number;
  const projectConfig = resolveProjectCommandConfig(context.repoConfig, context.input);

  try {
    const { graphql } = await context.getGitHubClient();
    const response = await graphql<ProjectStatusLookupResponse>(
      itemType === 'issue' ? PROJECT_STATUS_FOR_ISSUE_QUERY : PROJECT_STATUS_FOR_PULL_REQUEST_QUERY,
      {
        owner: context.repo.owner,
        repo: context.repo.name,
        itemNumber,
        statusFieldName: projectConfig.statusFieldName,
      },
    );

    const trackedNode = readTrackedNode(response, itemType, itemNumber);
    const projectItem = selectProjectItem(trackedNode, projectConfig.projectOwner, projectConfig.projectNumber, itemType, itemNumber);
    const statusField = readProjectStatusField(
      projectItem,
      projectConfig.projectOwner,
      projectConfig.projectNumber,
      projectConfig.statusFieldName,
    );
    const status = readProjectStatusValue(
      projectItem.fieldValueByName,
      statusField,
      projectConfig.projectOwner,
      projectConfig.projectNumber,
    );

    return {
      project_owner: projectConfig.projectOwner,
      project_number: projectConfig.projectNumber,
      status_field_name: statusField.name,
      status_field_id: statusField.id,
      item_type: itemType,
      item_number: itemNumber,
      project_item_id: readProjectItemId(projectItem),
      status_option_id: status?.option_id ?? null,
      status: status?.name ?? null,
    };
  } catch (error) {
    throw mapProjectGetStatusError(error, itemType, itemNumber);
  }
}

function readTrackedNode(response: ProjectStatusLookupResponse, itemType: ProjectItemType, itemNumber: number): ProjectTrackedNode {
  const repository = response.repository;
  if (!isObject(repository)) {
    throw new OrfeError('internal_error', 'GitHub project status response is missing repository data.');
  }

  const trackedNode = itemType === 'issue' ? repository.issue : repository.pullRequest;
  if (!isObject(trackedNode)) {
    throw new OrfeError(
      'github_not_found',
      itemType === 'issue' ? `Issue #${itemNumber} was not found.` : `Pull request #${itemNumber} was not found.`,
    );
  }

  return trackedNode as ProjectTrackedNode;
}

function selectProjectItem(
  trackedNode: ProjectTrackedNode,
  projectOwner: string,
  projectNumber: number,
  itemType: ProjectItemType,
  itemNumber: number,
): ProjectItemNode {
  const projectItems = trackedNode.projectItems;
  if (!isObject(projectItems) || !Array.isArray(projectItems.nodes)) {
    throw new OrfeError('internal_error', 'GitHub project status response is missing projectItems nodes.');
  }

  for (const rawNode of projectItems.nodes) {
    if (!isObject(rawNode)) {
      continue;
    }

    const projectItem = rawNode as ProjectItemNode;
    const projectItemId = readProjectItemId(projectItem);

    const project = projectItem.project;
    if (!isObject(project)) {
      throw new OrfeError('internal_error', `GitHub project item ${projectItemId} is missing project metadata.`);
    }

    const observedProjectNumber = (project as ProjectNode).number;
    const ownerNode = (project as ProjectNode).owner;
    if (!isObject(ownerNode) || typeof (ownerNode as ProjectOwnerNode).login !== 'string') {
      throw new OrfeError('internal_error', `GitHub project item ${projectItemId} is missing a valid project owner login.`);
    }

    if (observedProjectNumber === projectNumber && (ownerNode as ProjectOwnerNode).login === projectOwner) {
      return projectItem;
    }
  }

  throw new OrfeError(
    'project_item_not_found',
    `${itemType === 'issue' ? 'Issue' : 'Pull request'} #${itemNumber} is not present on GitHub Project ${projectOwner}/${projectNumber}.`,
  );
}

function readProjectItemId(projectItem: ProjectItemNode): string {
  if (typeof projectItem.id !== 'string' || projectItem.id.length === 0) {
    throw new OrfeError('internal_error', 'GitHub project item response is missing a valid id.');
  }

  return projectItem.id;
}

function readProjectStatusField(
  projectItem: ProjectItemNode,
  projectOwner: string,
  projectNumber: number,
  statusFieldName: string,
): ProjectStatusField {
  const project = projectItem.project;
  if (!isObject(project)) {
    throw new OrfeError('internal_error', `GitHub project item ${String(projectItem.id)} is missing project metadata.`);
  }

  const fields = (project as ProjectNode).fields;
  if (!isObject(fields) || !Array.isArray((fields as ProjectFieldsConnection).nodes)) {
    throw new OrfeError('internal_error', `GitHub Project ${projectOwner}/${projectNumber} is missing fields metadata.`);
  }

  const fieldNodes = (fields as ProjectFieldsConnection).nodes;
  if (!Array.isArray(fieldNodes)) {
    throw new OrfeError('internal_error', `GitHub Project ${projectOwner}/${projectNumber} is missing fields nodes.`);
  }

  for (const rawField of fieldNodes) {
    if (!isObject(rawField)) {
      continue;
    }

    const field = rawField as ProjectSingleSelectFieldNode;
    if (field.__typename !== 'ProjectV2SingleSelectField') {
      continue;
    }

    if (field.name === statusFieldName) {
      if (typeof field.id !== 'string' || field.id.length === 0) {
        throw new OrfeError(
          'internal_error',
          `GitHub Project ${projectOwner}/${projectNumber} returned an invalid id for field "${statusFieldName}".`,
        );
      }

      return {
        id: field.id,
        name: statusFieldName,
      };
    }
  }

  throw new OrfeError(
    'project_status_field_not_found',
    `GitHub Project ${projectOwner}/${projectNumber} has no single-select field named "${statusFieldName}".`,
  );
}

function readProjectStatusValue(
  rawValue: unknown,
  statusField: ProjectStatusField,
  projectOwner: string,
  projectNumber: number,
): ProjectStatusValue | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (!isObject(rawValue)) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid value for field "${statusField.name}".`,
    );
  }

  const statusValue = rawValue as ProjectSingleSelectFieldValueNode;
  if (statusValue.__typename !== 'ProjectV2ItemFieldSingleSelectValue') {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an unexpected value type for field "${statusField.name}".`,
    );
  }

  if (typeof statusValue.optionId !== 'string' || statusValue.optionId.length === 0) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid option id for field "${statusField.name}".`,
    );
  }

  if (!isObject(statusValue.field)) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned invalid field metadata for "${statusField.name}".`,
    );
  }

  const field = statusValue.field as ProjectSingleSelectFieldNode;
  if (field.id !== statusField.id || field.name !== statusField.name) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned mismatched field metadata for "${statusField.name}".`,
    );
  }

  if (typeof statusValue.name !== 'string') {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid status value for field "${statusField.name}".`,
    );
  }

  return {
    option_id: statusValue.optionId,
    name: statusValue.name,
  };
}

function mapProjectGetStatusError(error: unknown, itemType: ProjectItemType, itemNumber: number): OrfeError {
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
