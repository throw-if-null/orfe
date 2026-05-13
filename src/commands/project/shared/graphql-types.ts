export interface ProjectStatusLookupResponse {
  repository?: {
    issue?: ProjectTrackedNode | null;
    pullRequest?: ProjectTrackedNode | null;
  } | null;
}

export interface ProjectTrackedNode {
  projectItems?: {
    nodes?: unknown;
    pageInfo?: unknown;
  } | null;
}

export interface ProjectItemNode {
  id?: unknown;
  project?: unknown;
  fieldValueByName?: unknown;
}

export interface ProjectNode {
  id?: unknown;
  number?: unknown;
  owner?: unknown;
  fields?: unknown;
}

export interface ProjectOwnerNode {
  login?: unknown;
}

export interface ProjectFieldsConnection {
  nodes?: unknown;
  pageInfo?: unknown;
}

export interface ProjectFieldsLookupResponse {
  node?: unknown;
}

export interface ProjectOwnerLookupResponse {
  repositoryOwner?: unknown;
}

export interface ProjectAddItemMutationResponse {
  addProjectV2ItemById?: unknown;
}

export interface ProjectPageInfoNode {
  hasNextPage?: unknown;
  endCursor?: unknown;
}

export interface ProjectSingleSelectFieldNode {
  __typename?: unknown;
  id?: unknown;
  name?: unknown;
  options?: unknown;
}

export interface ProjectSingleSelectFieldOptionNode {
  id?: unknown;
  name?: unknown;
}

export interface ProjectSingleSelectFieldValueNode {
  __typename?: unknown;
  name?: unknown;
  optionId?: unknown;
  field?: unknown;
}
