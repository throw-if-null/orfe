import { OrfeError } from '../../errors.js';

export type ProjectItemType = 'issue' | 'pr';

export interface ProjectGetStatusData {
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

export interface ProjectSetStatusData {
  project_owner: string;
  project_number: number;
  status_field_name: string;
  status_field_id: string;
  item_type: ProjectItemType;
  item_number: number;
  project_item_id: string;
  status_option_id: string;
  status: string;
  previous_status_option_id: string | null;
  previous_status: string | null;
  changed: boolean;
}

export interface ProjectAddItemData {
  projectId: string;
  projectItemId: string;
}

export interface ResolvedProjectStatusContext {
  projectItem: ProjectItemNode;
  projectItemId: string;
  projectId: string;
  statusField: ProjectStatusField;
  status: ProjectStatusValue | null;
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
    pageInfo?: unknown;
  } | null;
}

interface ProjectItemNode {
  id?: unknown;
  project?: unknown;
  fieldValueByName?: unknown;
}

interface ProjectNode {
  id?: unknown;
  number?: unknown;
  owner?: unknown;
  fields?: unknown;
}

interface ProjectOwnerNode {
  login?: unknown;
}

interface ProjectFieldsConnection {
  nodes?: unknown;
  pageInfo?: unknown;
}

interface ProjectFieldsLookupResponse {
  node?: unknown;
}

interface ProjectOwnerLookupResponse {
  repositoryOwner?: unknown;
}

interface ProjectAddItemMutationResponse {
  addProjectV2ItemById?: unknown;
}

interface ProjectPageInfoNode {
  hasNextPage?: unknown;
  endCursor?: unknown;
}

interface ProjectSingleSelectFieldNode {
  __typename?: unknown;
  id?: unknown;
  name?: unknown;
  options?: unknown;
}

interface ProjectSingleSelectFieldOptionNode {
  id?: unknown;
  name?: unknown;
}

interface ProjectSingleSelectFieldValueNode {
  __typename?: unknown;
  name?: unknown;
  optionId?: unknown;
  field?: unknown;
}

export interface ProjectStatusField {
  id: string;
  name: string;
  options: ProjectStatusFieldOption[];
}

export interface ProjectStatusFieldOption {
  id: string;
  name: string;
}

export interface ProjectStatusValue {
  option_id: string;
  name: string;
}

const PROJECT_STATUS_FOR_ISSUE_QUERY = `
  query ProjectStatusForIssue($owner: String!, $repo: String!, $itemNumber: Int!, $statusFieldName: String!, $projectItemsCursor: String) {
    repository(owner: $owner, name: $repo) {
      issue(number: $itemNumber) {
        projectItems(first: 100, after: $projectItemsCursor) {
          nodes {
            id
            project {
              id
              number
              owner {
                ... on Organization {
                  login
                }
                ... on User {
                  login
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
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

const PROJECT_STATUS_FOR_PULL_REQUEST_QUERY = `
  query ProjectStatusForPullRequest($owner: String!, $repo: String!, $itemNumber: Int!, $statusFieldName: String!, $projectItemsCursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $itemNumber) {
        projectItems(first: 100, after: $projectItemsCursor) {
          nodes {
            id
            project {
              id
              number
              owner {
                ... on Organization {
                  login
                }
                ... on User {
                  login
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
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

const PROJECT_STATUS_FIELDS_QUERY = `
  query ProjectStatusFields($projectId: ID!, $fieldsCursor: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 100, after: $fieldsCursor) {
          nodes {
            __typename
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

const PROJECT_BY_OWNER_AND_NUMBER_QUERY = `
  query ProjectByOwnerAndNumber($login: String!, $number: Int!) {
    repositoryOwner(login: $login) {
      ... on Organization {
        projectV2(number: $number) {
          id
        }
      }
      ... on User {
        projectV2(number: $number) {
          id
        }
      }
    }
  }
`;

const PROJECT_ADD_ITEM_MUTATION = `
  mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(
      input: {
        projectId: $projectId
        contentId: $contentId
      }
    ) {
      item {
        id
      }
    }
  }
`;

const PROJECT_STATUS_UPDATE_MUTATION = `
  mutation UpdateProjectStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }
    ) {
      clientMutationId
    }
  }
`;

export async function resolveProjectStatusContext(
  graphql: <TResponse>(query: string, variables?: Record<string, unknown>) => Promise<TResponse>,
  owner: string,
  repo: string,
  projectOwner: string,
  projectNumber: number,
  statusFieldName: string,
  itemType: ProjectItemType,
  itemNumber: number,
): Promise<ResolvedProjectStatusContext> {
  const projectItem = await lookupProjectItem(graphql, owner, repo, projectOwner, projectNumber, statusFieldName, itemType, itemNumber);
  const projectId = readProjectId(readProject(projectItem), projectOwner, projectNumber);
  const projectItemId = readProjectItemId(projectItem);
  const statusField = await lookupProjectStatusField(graphql, projectItem, projectOwner, projectNumber, statusFieldName);
  const status = readProjectStatusValue(projectItem.fieldValueByName, statusField, projectOwner, projectNumber);

  return {
    projectItem,
    projectItemId,
    projectId,
    statusField,
    status,
  };
}

export async function updateProjectStatus(
  graphql: <TResponse>(query: string, variables?: Record<string, unknown>) => Promise<TResponse>,
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string,
): Promise<void> {
  await graphql(PROJECT_STATUS_UPDATE_MUTATION, {
    projectId,
    itemId,
    fieldId,
    optionId,
  });
}

export async function resolveProjectIdByOwnerAndNumber(
  graphql: <TResponse>(query: string, variables?: Record<string, unknown>) => Promise<TResponse>,
  projectOwner: string,
  projectNumber: number,
): Promise<string> {
  const response = await graphql<ProjectOwnerLookupResponse>(PROJECT_BY_OWNER_AND_NUMBER_QUERY, {
    login: projectOwner,
    number: projectNumber,
  });

  const projectNode = selectResolvedProjectNode(response, projectOwner, projectNumber);
  return readProjectId(projectNode, projectOwner, projectNumber);
}

export async function addProjectItemByContentId(
  graphql: <TResponse>(query: string, variables?: Record<string, unknown>) => Promise<TResponse>,
  projectId: string,
  contentId: string,
): Promise<ProjectAddItemData> {
  const response = await graphql<ProjectAddItemMutationResponse>(PROJECT_ADD_ITEM_MUTATION, {
    projectId,
    contentId,
  });

  const mutationResult = response.addProjectV2ItemById;
  if (!isObject(mutationResult) || !isObject(mutationResult.item) || typeof mutationResult.item.id !== 'string' || mutationResult.item.id.length === 0) {
    throw new OrfeError('internal_error', 'GitHub project add-item response is missing a valid project item id.');
  }

  return {
    projectId,
    projectItemId: mutationResult.item.id,
  };
}

export function selectProjectStatusOption(
  statusField: ProjectStatusField,
  projectOwner: string,
  projectNumber: number,
  targetStatus: string,
): ProjectStatusFieldOption {
  for (const option of statusField.options) {
    if (option.name === targetStatus) {
      return option;
    }
  }

  throw new OrfeError(
    'project_status_option_not_found',
    `GitHub Project ${projectOwner}/${projectNumber} field "${statusField.name}" has no option named "${targetStatus}".`,
  );
}

export function normalizeProjectSetStatusResult(
  projectOwner: string,
  projectNumber: number,
  itemType: ProjectItemType,
  itemNumber: number,
  currentStatusContext: ResolvedProjectStatusContext,
  observedStatus: ProjectStatusValue | null,
  changed: boolean,
): ProjectSetStatusData {
  if (observedStatus === null) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned no resulting status value for ${formatProjectTrackedItem(itemType)} #${itemNumber}.`,
    );
  }

  return {
    project_owner: projectOwner,
    project_number: projectNumber,
    status_field_name: currentStatusContext.statusField.name,
    status_field_id: currentStatusContext.statusField.id,
    item_type: itemType,
    item_number: itemNumber,
    project_item_id: currentStatusContext.projectItemId,
    status_option_id: observedStatus.option_id,
    status: observedStatus.name,
    previous_status_option_id: currentStatusContext.status?.option_id ?? null,
    previous_status: currentStatusContext.status?.name ?? null,
    changed,
  };
}

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

async function lookupProjectItem(
  graphql: <TResponse>(query: string, variables?: Record<string, unknown>) => Promise<TResponse>,
  owner: string,
  repo: string,
  projectOwner: string,
  projectNumber: number,
  statusFieldName: string,
  itemType: ProjectItemType,
  itemNumber: number,
): Promise<ProjectItemNode> {
  let projectItemsCursor: string | null = null;

  while (true) {
    const response = await graphql<ProjectStatusLookupResponse>(
      itemType === 'issue' ? PROJECT_STATUS_FOR_ISSUE_QUERY : PROJECT_STATUS_FOR_PULL_REQUEST_QUERY,
      {
        owner,
        repo,
        itemNumber,
        statusFieldName,
        projectItemsCursor,
      },
    );

    const trackedNode = readTrackedNode(response, itemType, itemNumber);
    const projectItems = readTrackedProjectItems(trackedNode);
    const projectItem = selectProjectItem(projectItems.nodes, projectOwner, projectNumber);

    if (projectItem !== null) {
      return projectItem;
    }

    const pageInfo = readPageInfo(projectItems.pageInfo, 'GitHub project status response is missing projectItems page info.');
    if (!pageInfo.hasNextPage) {
      break;
    }

    projectItemsCursor = pageInfo.endCursor;
  }

  throw new OrfeError(
    'project_item_not_found',
    `${itemType === 'issue' ? 'Issue' : 'Pull request'} #${itemNumber} is not present on GitHub Project ${projectOwner}/${projectNumber}.`,
  );
}

async function lookupProjectStatusField(
  graphql: <TResponse>(query: string, variables?: Record<string, unknown>) => Promise<TResponse>,
  projectItem: ProjectItemNode,
  projectOwner: string,
  projectNumber: number,
  statusFieldName: string,
): Promise<ProjectStatusField> {
  const project = readProject(projectItem);
  const projectId = readProjectId(project, projectOwner, projectNumber);
  let fieldsCursor: string | null = null;

  while (true) {
    const response = await graphql<ProjectFieldsLookupResponse>(PROJECT_STATUS_FIELDS_QUERY, {
      projectId,
      fieldsCursor,
    });

    const fields = readProjectFieldsConnection(response, projectOwner, projectNumber);
    const statusField = selectProjectStatusField(fields.nodes, projectOwner, projectNumber, statusFieldName);

    if (statusField !== null) {
      return statusField;
    }

    const pageInfo = readPageInfo(fields.pageInfo, `GitHub Project ${projectOwner}/${projectNumber} is missing fields page info.`);
    if (!pageInfo.hasNextPage) {
      break;
    }

    fieldsCursor = pageInfo.endCursor;
  }

  throw new OrfeError(
    'project_status_field_not_found',
    `GitHub Project ${projectOwner}/${projectNumber} has no single-select field named "${statusFieldName}".`,
  );
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

function selectResolvedProjectNode(
  response: ProjectOwnerLookupResponse,
  projectOwner: string,
  projectNumber: number,
): ProjectNode {
  if (!isObject(response.repositoryOwner)) {
    throw new OrfeError('github_not_found', `GitHub Project ${projectOwner}/${projectNumber} was not found.`);
  }

  const project = readProjectNode((response.repositoryOwner as { projectV2?: unknown }).projectV2);
  if (project !== null) {
    return project;
  }

  throw new OrfeError('github_not_found', `GitHub Project ${projectOwner}/${projectNumber} was not found.`);
}

function readTrackedProjectItems(trackedNode: ProjectTrackedNode): { nodes: unknown[]; pageInfo?: unknown } {
  const projectItems = trackedNode.projectItems;
  if (!isObject(projectItems) || !Array.isArray(projectItems.nodes)) {
    throw new OrfeError('internal_error', 'GitHub project status response is missing projectItems nodes.');
  }

  return projectItems as { nodes: unknown[]; pageInfo?: unknown };
}

function readProjectNode(value: unknown): ProjectNode | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isObject(value)) {
    throw new OrfeError('internal_error', 'GitHub project lookup response returned invalid project metadata.');
  }

  return value as ProjectNode;
}

function selectProjectItem(projectItemNodes: unknown[], projectOwner: string, projectNumber: number): ProjectItemNode | null {
  for (const rawNode of projectItemNodes) {
    if (!isObject(rawNode)) {
      continue;
    }

    const projectItem = rawNode as ProjectItemNode;
    const project = readProject(projectItem);
    const observedProjectNumber = project.number;
    const ownerNode = project.owner;
    if (!isObject(ownerNode) || typeof (ownerNode as ProjectOwnerNode).login !== 'string') {
      throw new OrfeError(
        'internal_error',
        `GitHub project item ${readProjectItemId(projectItem)} is missing a valid project owner login.`,
      );
    }

    if (observedProjectNumber === projectNumber && (ownerNode as ProjectOwnerNode).login === projectOwner) {
      return projectItem;
    }
  }

  return null;
}

function readProjectItemId(projectItem: ProjectItemNode): string {
  if (typeof projectItem.id !== 'string' || projectItem.id.length === 0) {
    throw new OrfeError('internal_error', 'GitHub project item response is missing a valid id.');
  }

  return projectItem.id;
}

function readProject(projectItem: ProjectItemNode): ProjectNode {
  const project = projectItem.project;
  if (!isObject(project)) {
    throw new OrfeError('internal_error', `GitHub project item ${readProjectItemId(projectItem)} is missing project metadata.`);
  }

  return project as ProjectNode;
}

function readProjectId(project: ProjectNode, projectOwner: string, projectNumber: number): string {
  if (typeof project.id !== 'string' || project.id.length === 0) {
    throw new OrfeError('internal_error', `GitHub Project ${projectOwner}/${projectNumber} returned an invalid id.`);
  }

  return project.id;
}

function readProjectFieldsConnection(response: ProjectFieldsLookupResponse, projectOwner: string, projectNumber: number): ProjectFieldsConnection {
  if (!isObject(response.node)) {
    throw new OrfeError('internal_error', `GitHub Project ${projectOwner}/${projectNumber} is missing fields metadata.`);
  }

  const fields = (response.node as ProjectNode).fields;
  if (!isObject(fields) || !Array.isArray((fields as ProjectFieldsConnection).nodes)) {
    throw new OrfeError('internal_error', `GitHub Project ${projectOwner}/${projectNumber} is missing fields metadata.`);
  }

  return fields as ProjectFieldsConnection;
}

function selectProjectStatusField(
  fieldNodes: unknown,
  projectOwner: string,
  projectNumber: number,
  statusFieldName: string,
): ProjectStatusField | null {
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
        options: readProjectStatusFieldOptions(field.options, projectOwner, projectNumber, statusFieldName),
      };
    }
  }

  return null;
}

function readPageInfo(rawPageInfo: unknown, missingMessage: string): { hasNextPage: boolean; endCursor: string | null } {
  if (!isObject(rawPageInfo)) {
    throw new OrfeError('internal_error', missingMessage);
  }

  const pageInfo = rawPageInfo as ProjectPageInfoNode;
  if (typeof pageInfo.hasNextPage !== 'boolean') {
    throw new OrfeError('internal_error', missingMessage);
  }

  if (pageInfo.hasNextPage) {
    if (typeof pageInfo.endCursor !== 'string' || pageInfo.endCursor.length === 0) {
      throw new OrfeError('internal_error', missingMessage);
    }

    return {
      hasNextPage: true,
      endCursor: pageInfo.endCursor,
    };
  }

  return {
    hasNextPage: false,
    endCursor: null,
  };
}

function readProjectStatusFieldOptions(
  rawOptions: unknown,
  projectOwner: string,
  projectNumber: number,
  statusFieldName: string,
): ProjectStatusFieldOption[] {
  if (rawOptions === undefined || rawOptions === null) {
    return [];
  }

  if (!Array.isArray(rawOptions)) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned invalid options metadata for field "${statusFieldName}".`,
    );
  }

  return rawOptions.map((rawOption) => readProjectStatusFieldOption(rawOption, projectOwner, projectNumber, statusFieldName));
}

function readProjectStatusFieldOption(
  rawOption: unknown,
  projectOwner: string,
  projectNumber: number,
  statusFieldName: string,
): ProjectStatusFieldOption {
  if (!isObject(rawOption)) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid option entry for field "${statusFieldName}".`,
    );
  }

  const option = rawOption as ProjectSingleSelectFieldOptionNode;
  if (typeof option.id !== 'string' || option.id.length === 0) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid option id for field "${statusFieldName}".`,
    );
  }

  if (typeof option.name !== 'string') {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid option name for field "${statusFieldName}".`,
    );
  }

  return {
    id: option.id,
    name: option.name,
  };
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
