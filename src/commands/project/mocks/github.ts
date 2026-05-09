import nock from 'nock';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function matchesProjectByOwnerAndNumber(body: unknown, options: { projectOwner: string; projectNumber: number }): boolean {
  return (
    isObject(body) &&
    typeof body.query === 'string' &&
    body.query.includes('query ProjectByOwnerAndNumber') &&
    isObject(body.variables) &&
    body.variables.login === options.projectOwner &&
    body.variables.number === options.projectNumber
  );
}

function matchesProjectAddItem(body: unknown, options: { projectId: string; contentId: string }): boolean {
  return (
    isObject(body) &&
    typeof body.query === 'string' &&
    body.query.includes('mutation AddProjectItem') &&
    isObject(body.variables) &&
    body.variables.projectId === options.projectId &&
    body.variables.contentId === options.contentId
  );
}

function matchesProjectStatusLookup(body: unknown, options: { itemType: 'issue' | 'pr'; itemNumber: number; statusFieldName: string }): boolean {
  const expectedQueryName = options.itemType === 'issue' ? 'query ProjectStatusForIssue' : 'query ProjectStatusForPullRequest';

  return (
    isObject(body) &&
    typeof body.query === 'string' &&
    body.query.includes(expectedQueryName) &&
    isObject(body.variables) &&
    body.variables.itemNumber === options.itemNumber &&
    body.variables.statusFieldName === options.statusFieldName
  );
}

function matchesProjectStatusFields(body: unknown, options: { projectId: string; fieldsCursor?: string | null }): boolean {
  return (
    isObject(body) &&
    typeof body.query === 'string' &&
    body.query.includes('query ProjectStatusFields') &&
    isObject(body.variables) &&
    body.variables.projectId === options.projectId &&
    body.variables.fieldsCursor === (options.fieldsCursor ?? null)
  );
}

function matchesProjectStatusUpdate(body: unknown, options: { projectId: string; itemId: string; fieldId: string; optionId: string }): boolean {
  return (
    isObject(body) &&
    typeof body.query === 'string' &&
    body.query.includes('mutation UpdateProjectStatus') &&
    isObject(body.variables) &&
    body.variables.projectId === options.projectId &&
    body.variables.itemId === options.itemId &&
    body.variables.fieldId === options.fieldId &&
    body.variables.optionId === options.optionId
  );
}

function createPageInfo(options?: { hasNextPage?: boolean; endCursor?: string | null }) {
  return {
    hasNextPage: options?.hasNextPage ?? false,
    endCursor: options?.endCursor ?? null,
  };
}

export function createProjectLookupResponse(options: { projectId: string; ownerType?: 'organization' | 'user' }) {
  return {
    data: {
      repositoryOwner: {
        __typename: options.ownerType === 'user' ? 'User' : 'Organization',
        projectV2: {
          id: options.projectId,
        },
      },
    },
  };
}

export function createProjectItemsConnection(nodes: unknown[], options?: { hasNextPage?: boolean; endCursor?: string | null }) {
  return {
    nodes,
    pageInfo: createPageInfo(options),
  };
}

export function createProjectFieldsConnection(nodes: unknown[], options?: { hasNextPage?: boolean; endCursor?: string | null }) {
  return {
    nodes,
    pageInfo: createPageInfo(options),
  };
}

export function createProjectStatusFieldNode(options: { id: string; name: string; options?: Array<{ id: string; name: string }> }) {
  return {
    __typename: 'ProjectV2SingleSelectField',
    id: options.id,
    name: options.name,
    ...(options.options ? { options: options.options } : {}),
  };
}

export function createProjectStatusValueNode(options: { fieldId: string; fieldName: string; optionId: string; name: string }) {
  return {
    __typename: 'ProjectV2ItemFieldSingleSelectValue',
    optionId: options.optionId,
    name: options.name,
    field: {
      __typename: 'ProjectV2SingleSelectField',
      id: options.fieldId,
      name: options.fieldName,
    },
  };
}

export function createProjectItemNode(options: {
  id: string;
  projectId?: string;
  projectOwner: string;
  projectNumber: number;
  fields?: unknown[];
  statusValue?: unknown;
}) {
  return {
    id: options.id,
    project: {
      id: options.projectId ?? 'PVT_project_1',
      number: options.projectNumber,
      owner: {
        login: options.projectOwner,
      },
      ...(options.fields
        ? {
            fields: {
              nodes: options.fields,
            },
          }
        : {}),
    },
    fieldValueByName: options.statusValue ?? null,
  };
}

export function mockProjectGetStatusRequest(options: {
  itemType: 'issue' | 'pr';
  itemNumber: number;
  statusFieldName?: string;
  graphqlStatus?: number;
  graphqlResponseBody?: Record<string, unknown>;
  projectItemsCursor?: string | null;
  includeAuth?: boolean;
}) {
  const statusFieldName = options.statusFieldName ?? 'Status';

  let scope = nock('https://api.github.com');
  if (options.includeAuth !== false) {
    scope = scope
      .get('/repos/throw-if-null/orfe/installation')
      .reply(200, { id: 42 })
      .post('/app/installations/42/access_tokens')
      .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' });
  }

  return scope
    .post('/graphql', (body: unknown) =>
      matchesProjectStatusLookup(body, {
        itemType: options.itemType,
        itemNumber: options.itemNumber,
        statusFieldName,
      }) && isObject(body) && isObject(body.variables) && body.variables.projectItemsCursor === (options.projectItemsCursor ?? null),
    )
    .reply(
      options.graphqlStatus ?? 200,
      options.graphqlResponseBody ?? {
        data: {
          repository:
            options.itemType === 'issue'
              ? {
                  issue: {
                    projectItems: createProjectItemsConnection([]),
                  },
                }
              : {
                  pullRequest: {
                    projectItems: createProjectItemsConnection([]),
                  },
                },
        },
      },
    );
}

export function mockProjectStatusFieldsRequest(options: {
  projectId?: string;
  fieldsCursor?: string | null;
  graphqlStatus?: number;
  graphqlResponseBody?: Record<string, unknown>;
}) {
  return nock('https://api.github.com')
    .post('/graphql', (body: unknown) =>
      matchesProjectStatusFields(body, {
        projectId: options.projectId ?? 'PVT_project_1',
        ...(options.fieldsCursor !== undefined ? { fieldsCursor: options.fieldsCursor } : {}),
      }),
    )
    .reply(
      options.graphqlStatus ?? 200,
      options.graphqlResponseBody ?? {
        data: {
          node: {
            fields: createProjectFieldsConnection([]),
          },
        },
      },
    );
}

export function mockProjectStatusUpdateRequest(options: {
  projectId?: string;
  itemId: string;
  fieldId: string;
  optionId: string;
  graphqlStatus?: number;
  graphqlResponseBody?: Record<string, unknown>;
}) {
  return nock('https://api.github.com')
    .post('/graphql', (body: unknown) =>
      matchesProjectStatusUpdate(body, {
        projectId: options.projectId ?? 'PVT_project_1',
        itemId: options.itemId,
        fieldId: options.fieldId,
        optionId: options.optionId,
      }),
    )
    .reply(
      options.graphqlStatus ?? 200,
      options.graphqlResponseBody ?? {
        data: {
          updateProjectV2ItemFieldValue: {
            clientMutationId: null,
          },
        },
      },
    );
}

export function mockProjectLookupRequest(options: {
  projectOwner: string;
  projectNumber: number;
  projectId?: string;
  graphqlStatus?: number;
  graphqlResponseBody?: Record<string, unknown>;
  includeAuth?: boolean;
}) {
  let scope = nock('https://api.github.com');
  if (options.includeAuth !== false) {
    scope = scope
      .get('/repos/throw-if-null/orfe/installation')
      .reply(200, { id: 42 })
      .post('/app/installations/42/access_tokens')
      .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' });
  }

  return scope
    .post('/graphql', (body: unknown) =>
      matchesProjectByOwnerAndNumber(body, {
        projectOwner: options.projectOwner,
        projectNumber: options.projectNumber,
      }),
    )
    .reply(
      options.graphqlStatus ?? 200,
      options.graphqlResponseBody ?? createProjectLookupResponse({ projectId: options.projectId ?? 'PVT_project_1' }),
    );
}

export function mockProjectAddItemRequest(options: {
  projectId?: string;
  contentId: string;
  projectItemId?: string;
  graphqlStatus?: number;
  graphqlResponseBody?: Record<string, unknown>;
  includeAuth?: boolean;
}) {
  let scope = nock('https://api.github.com');
  if (options.includeAuth !== false) {
    scope = scope
      .get('/repos/throw-if-null/orfe/installation')
      .reply(200, { id: 42 })
      .post('/app/installations/42/access_tokens')
      .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' });
  }

  return scope
    .post('/graphql', (body: unknown) =>
      matchesProjectAddItem(body, {
        projectId: options.projectId ?? 'PVT_project_1',
        contentId: options.contentId,
      }),
    )
    .reply(
      options.graphqlStatus ?? 200,
      options.graphqlResponseBody ?? {
        data: {
          addProjectV2ItemById: {
            item: {
              id: options.projectItemId ?? 'PVTI_lAHOABCD1234',
            },
          },
        },
      },
    );
}
