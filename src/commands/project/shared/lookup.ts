import { OrfeError } from '../../../runtime/errors.js';
import type {
  ProjectFieldsConnection,
  ProjectFieldsLookupResponse,
  ProjectItemNode,
  ProjectNode,
  ProjectOwnerLookupResponse,
  ProjectOwnerNode,
  ProjectPageInfoNode,
  ProjectStatusLookupResponse,
  ProjectTrackedNode,
} from './graphql-types.js';
import {
  PROJECT_BY_OWNER_AND_NUMBER_QUERY,
  PROJECT_STATUS_FIELDS_QUERY,
  PROJECT_STATUS_FOR_ISSUE_QUERY,
  PROJECT_STATUS_FOR_PULL_REQUEST_QUERY,
} from './queries.js';
import {
  readProjectStatusValue,
  selectProjectStatusField,
  type ProjectStatusField,
  type ProjectStatusValue,
} from './status-field.js';

export type ProjectItemType = 'issue' | 'pr';

export interface ResolvedProjectStatusContext {
  projectItem: ProjectItemNode;
  projectItemId: string;
  projectId: string;
  statusField: ProjectStatusField;
  status: ProjectStatusValue | null;
}

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
