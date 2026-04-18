import assert from 'node:assert/strict';
import nock from 'nock';
import test from 'node:test';

import { COMMANDS } from '../src/commands/index.js';
import { listCommandNames } from '../src/commands/registry/index.js';
import { OrfeError } from '../src/errors.js';
import { GitHubClientFactory } from '../src/github.js';
import { createRuntimeSnapshot, runOrfeCore } from '../src/core.js';

const COMMAND_NAMES = COMMANDS.map((definition) => definition.name);

function createRepoConfig() {
  return {
    configPath: '/tmp/.orfe/config.json',
    version: 1 as const,
    repository: {
      owner: 'throw-if-null',
      name: 'orfe',
      defaultBranch: 'main',
    },
    callerToBot: {
      Greg: 'greg',
    },
    projects: {
      default: {
        owner: 'throw-if-null',
        projectNumber: 1,
        statusFieldName: 'Status',
      },
    },
  };
}

function createAuthConfig() {
  return {
    configPath: '/tmp/auth.json',
    version: 1 as const,
    bots: {
      greg: {
        provider: 'github-app' as const,
        appId: 123458,
        appSlug: 'GR3G-BOT',
        privateKeyPath: '/tmp/greg.pem',
      },
    },
  };
}

function createGitHubClientFactory() {
  return new GitHubClientFactory({
    readFileImpl: async () => 'private-key',
    jwtFactory: () => 'jwt-token',
  });
}

function mockAuthTokenMintRequest(options: { repo?: { owner: string; name: string }; installationStatus?: number; tokenStatus?: number }) {
  const owner = options.repo?.owner ?? 'throw-if-null';
  const repo = options.repo?.name ?? 'orfe';

  const scope = nock('https://api.github.com').get(`/repos/${owner}/${repo}/installation`).reply(options.installationStatus ?? 200, {
    id: 42,
  });

  if ((options.installationStatus ?? 200) === 200) {
    scope.post('/app/installations/42/access_tokens').reply(options.tokenStatus ?? 201, {
      token: 'ghs_123',
      expires_at: '2026-04-06T12:00:00Z',
    });
  }

  return scope;
}

function mockIssueGetRequest(options: {
  issueNumber: number;
  status?: number;
  responseBody?: Record<string, unknown>;
}) {
  const issueNumber = options.issueNumber;
  const status = options.status ?? 200;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${issueNumber}`)
    .reply(
      status,
      options.responseBody ?? {
        number: issueNumber,
        title: 'Build `orfe` foundation and runtime scaffolding',
        body: 'Issue body',
        state: 'open',
        state_reason: null,
        labels: [{ name: 'needs-input' }],
        assignees: [{ login: 'greg' }],
        html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
      },
     );
}

function mockIssueCommentRequest(options: {
  issueNumber: number;
  body: string;
  status?: number;
  responseBody?: Record<string, unknown>;
  issueGetStatus?: number;
  issueGetResponseBody?: Record<string, unknown>;
}) {
  const issueNumber = options.issueNumber;
  const status = options.status ?? 201;
  const issueGetStatus = options.issueGetStatus ?? 200;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${issueNumber}`)
    .reply(
      issueGetStatus,
      options.issueGetResponseBody ?? {
        number: issueNumber,
        title: 'Issue title',
        body: 'Issue body',
        state: 'open',
        state_reason: null,
        labels: [],
        assignees: [],
        html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
      },
    )
    .post(`/repos/throw-if-null/orfe/issues/${issueNumber}/comments`, { body: options.body })
    .reply(
      status,
      options.responseBody ?? {
        id: 123456,
        html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}#issuecomment-123456`,
      },
     );
}

function mockIssueCreateRequest(options: {
  requestBody: Record<string, unknown>;
  status?: number;
  responseBody?: Record<string, unknown>;
  repo?: { owner: string; name: string };
}) {
  const owner = options.repo?.owner ?? 'throw-if-null';
  const repo = options.repo?.name ?? 'orfe';
  const status = options.status ?? 201;

  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/installation`)
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .post(`/repos/${owner}/${repo}/issues`, options.requestBody)
    .reply(
      status,
      options.responseBody ?? {
        number: 21,
        title: options.requestBody.title,
        body: options.requestBody.body ?? '',
        state: 'open',
        state_reason: null,
        labels: ((options.requestBody.labels as string[] | undefined) ?? []).map((name) => ({ name })),
        assignees: ((options.requestBody.assignees as string[] | undefined) ?? []).map((login) => ({ login })),
        html_url: `https://github.com/${owner}/${repo}/issues/21`,
      },
     );
}

function mockIssueUpdateRequest(options: {
  issueNumber: number;
  requestBody: Record<string, unknown>;
  status?: number;
  responseBody?: Record<string, unknown>;
  issueGetStatus?: number;
  issueGetResponseBody?: Record<string, unknown>;
}) {
  const issueNumber = options.issueNumber;
  const status = options.status ?? 200;
  const issueGetStatus = options.issueGetStatus ?? 200;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${issueNumber}`)
    .reply(
      issueGetStatus,
      options.issueGetResponseBody ?? {
        number: issueNumber,
        title: 'Updated title',
        body: 'Updated body',
        state: 'open',
        state_reason: null,
        labels: [{ name: 'bug' }, { name: 'needs-input' }],
        assignees: [{ login: 'greg' }],
        html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
      },
    )
    .patch(`/repos/throw-if-null/orfe/issues/${issueNumber}`, options.requestBody)
    .reply(
      status,
      options.responseBody ?? {
        number: issueNumber,
        title: 'Updated title',
        body: 'Updated body',
        state: 'open',
        state_reason: null,
        labels: [{ name: 'bug' }, { name: 'needs-input' }],
        assignees: [{ login: 'greg' }],
        html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
      },
     );
}

function mockPullRequestGetRequest(options: {
  prNumber: number;
  status?: number;
  responseBody?: Record<string, unknown>;
}) {
  const prNumber = options.prNumber;
  const status = options.status ?? 200;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(
      status,
      options.responseBody ?? {
        number: prNumber,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: { ref: 'issues/orfe-13' },
        base: { ref: 'main' },
        html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
      },
     );
}

function mockPullRequestGetOrCreateRequest(options: {
  head: string;
  base?: string;
  existingPullRequests?: Record<string, unknown>[];
  listStatus?: number;
  listResponseBody?: unknown;
  createRequestBody?: Record<string, unknown>;
  createStatus?: number;
  createResponseBody?: Record<string, unknown>;
}) {
  const head = options.head;
  const base = options.base ?? 'main';
  const scope = nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get('/repos/throw-if-null/orfe/pulls')
    .query({ state: 'open', head: `throw-if-null:${head}`, base, per_page: 100 })
    .reply(options.listStatus ?? 200, options.listResponseBody ?? options.existingPullRequests ?? []);

  if (options.createStatus !== undefined || options.createResponseBody !== undefined || options.createRequestBody !== undefined) {
    scope
      .post('/repos/throw-if-null/orfe/pulls', options.createRequestBody ?? {
        head,
        base,
        title: 'Design the `orfe` custom tool and CLI contract',
        draft: false,
      })
      .reply(
        options.createStatus ?? 201,
        options.createResponseBody ?? {
          number: 9,
          title: 'Design the `orfe` custom tool and CLI contract',
          body: 'PR body',
          state: 'open',
          draft: false,
          head: { ref: head },
          base: { ref: base },
          html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        },
      );
  }

  return scope;
}

function mockPullRequestCommentRequest(options: {
  prNumber: number;
  body: string;
  verifyStatus?: number;
  verifyResponseBody?: Record<string, unknown>;
  status?: number;
  responseBody?: Record<string, unknown>;
}) {
  const prNumber = options.prNumber;
  const verifyStatus = options.verifyStatus ?? 200;
  const status = options.status ?? 201;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(
      verifyStatus,
      options.verifyResponseBody ?? {
        number: prNumber,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: { ref: 'issues/orfe-13' },
        base: { ref: 'main' },
        html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
      },
    )
    .post(`/repos/throw-if-null/orfe/issues/${prNumber}/comments`, { body: options.body })
    .reply(
      status,
      options.responseBody ?? {
        id: 123456,
        html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}#issuecomment-123456`,
      },
    );
}

function mockPullRequestReplyRequest(options: {
  prNumber: number;
  commentId: number;
  body: string;
  verifyStatus?: number;
  verifyResponseBody?: Record<string, unknown>;
  status?: number;
  responseBody?: Record<string, unknown>;
}) {
  const prNumber = options.prNumber;
  const commentId = options.commentId;
  const verifyStatus = options.verifyStatus ?? 200;
  const status = options.status ?? 201;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(
      verifyStatus,
      options.verifyResponseBody ?? {
        number: prNumber,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: { ref: 'issues/orfe-13' },
        base: { ref: 'main' },
        html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
      },
    )
    .post(`/repos/throw-if-null/orfe/pulls/${prNumber}/comments/${commentId}/replies`, { body: options.body })
    .reply(
      status,
      options.responseBody ?? {
        id: 123999,
        in_reply_to_id: commentId,
      },
    );
}

function mockPullRequestSubmitReviewRequest(options: {
  prNumber: number;
  body: string;
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  verifyStatus?: number;
  verifyResponseBody?: Record<string, unknown>;
  status?: number;
  responseBody?: Record<string, unknown>;
}) {
  const prNumber = options.prNumber;
  const verifyStatus = options.verifyStatus ?? 200;
  const status = options.status ?? 200;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(
      verifyStatus,
      options.verifyResponseBody ?? {
        number: prNumber,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: { ref: 'issues/orfe-13' },
        base: { ref: 'main' },
        html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
      },
    )
    .post(`/repos/throw-if-null/orfe/pulls/${prNumber}/reviews`, {
      body: options.body,
      event: options.event,
    })
    .reply(
      status,
      options.responseBody ?? {
        id: 555,
      },
    );
}

function createIssueRestResponse(issueNumber: number, overrides: Record<string, unknown> = {}) {
  return {
    number: issueNumber,
    title: 'Issue title',
    body: 'Issue body',
    state: 'open',
    state_reason: null,
    labels: [],
    assignees: [],
    html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
    ...overrides,
  };
}

function createIssueStateNode(options: {
  id: string;
  issueNumber: number;
  state: string;
  stateReason?: string | null;
  duplicateOfIssueNumber?: number;
  duplicateOfId?: string;
}) {
  return {
    id: options.id,
    number: options.issueNumber,
    state: options.state,
    stateReason: options.stateReason ?? null,
    duplicateOf:
      options.duplicateOfIssueNumber !== undefined
        ? {
            id: options.duplicateOfId ?? `I_${options.duplicateOfIssueNumber}`,
            number: options.duplicateOfIssueNumber,
          }
        : null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function matchesIssueStateLookup(body: unknown, issueNumber: number): boolean {
  return (
    isObject(body) &&
    typeof body.query === 'string' &&
    body.query.includes('query IssueStateByNumber') &&
    isObject(body.variables) &&
    body.variables.issueNumber === issueNumber
  );
}

function matchesMarkIssueAsDuplicate(body: unknown, duplicateId: string, canonicalId: string): boolean {
  return (
    isObject(body) &&
    typeof body.query === 'string' &&
    body.query.includes('mutation MarkIssueAsDuplicate') &&
    isObject(body.variables) &&
    body.variables.duplicateId === duplicateId &&
    body.variables.canonicalId === canonicalId
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

function createProjectItemsConnection(nodes: unknown[], options?: { hasNextPage?: boolean; endCursor?: string | null }) {
  return {
    nodes,
    pageInfo: createPageInfo(options),
  };
}

function createProjectFieldsConnection(nodes: unknown[], options?: { hasNextPage?: boolean; endCursor?: string | null }) {
  return {
    nodes,
    pageInfo: createPageInfo(options),
  };
}

function createProjectStatusFieldNode(options: { id: string; name: string }) {
  return {
    __typename: 'ProjectV2SingleSelectField',
    id: options.id,
    name: options.name,
  };
}

function createProjectStatusValueNode(options: { fieldId: string; fieldName: string; optionId: string; name: string }) {
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

function createProjectItemNode(options: {
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
      fields: {
        nodes: options.fields ?? [],
      },
    },
    fieldValueByName: options.statusValue ?? null,
  };
}

function mockProjectGetStatusRequest(options: {
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

function mockProjectStatusFieldsRequest(options: {
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

function mockProjectStatusUpdateRequest(options: {
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

function matchesUnmarkIssueAsDuplicate(body: unknown, duplicateId: string, canonicalId: string): boolean {
  return (
    isObject(body) &&
    typeof body.query === 'string' &&
    body.query.includes('mutation UnmarkIssueAsDuplicate') &&
    isObject(body.variables) &&
    body.variables.duplicateId === duplicateId &&
    body.variables.canonicalId === canonicalId
  );
}

function mockIssueSetStateRequest(options: {
  issueNumber: number;
  currentIssueState: Record<string, unknown>;
  restUpdateBody?: Record<string, unknown>;
  observedIssueState?: Record<string, unknown>;
  issueGetStatus?: number;
  issueGetResponseBody?: Record<string, unknown>;
  includeGraphql?: boolean;
  unmark?: { duplicateId: string; canonicalId: string };
}) {
  const scope = nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${options.issueNumber}`)
    .reply(options.issueGetStatus ?? 200, options.issueGetResponseBody ?? createIssueRestResponse(options.issueNumber));

  if (options.includeGraphql !== false) {
    scope.post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.issueNumber)).reply(200, {
      data: { repository: { issue: options.currentIssueState } },
    });
  }

  if (options.unmark) {
    scope
      .post('/graphql', (body: unknown) => matchesUnmarkIssueAsDuplicate(body, options.unmark!.duplicateId, options.unmark!.canonicalId))
      .reply(200, { data: { unmarkIssueAsDuplicate: { clientMutationId: null } } });
  }

  if (options.restUpdateBody) {
    scope
      .patch(`/repos/throw-if-null/orfe/issues/${options.issueNumber}`, options.restUpdateBody)
      .reply(200, createIssueRestResponse(options.issueNumber, options.restUpdateBody))
      .post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.issueNumber))
      .reply(200, { data: { repository: { issue: options.observedIssueState ?? options.currentIssueState } } });
  }

  return scope;
}

function mockIssueSetStateDuplicateRequest(options: {
  issueNumber: number;
  duplicateOfIssueNumber: number;
  currentIssueState: Record<string, unknown>;
  canonicalIssueState: Record<string, unknown> | null;
  duplicateTargetGetStatus?: number;
  duplicateTargetGetResponseBody?: Record<string, unknown>;
  unmark?: { duplicateId: string; canonicalId: string };
  mark?: { duplicateId: string; canonicalId: string };
  restUpdateBody?: Record<string, unknown>;
  observedIssueState?: Record<string, unknown>;
  issueGetStatus?: number;
  issueGetResponseBody?: Record<string, unknown>;
  includeGraphql?: boolean;
}) {
  const scope = nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${options.issueNumber}`)
    .reply(options.issueGetStatus ?? 200, options.issueGetResponseBody ?? createIssueRestResponse(options.issueNumber));

  if (options.includeGraphql !== false) {
    scope
      .post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.issueNumber))
      .reply(200, { data: { repository: { issue: options.currentIssueState } } })
      .post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.duplicateOfIssueNumber))
      .reply(200, { data: { repository: { issue: options.canonicalIssueState } } });
  }

  if (options.canonicalIssueState === null) {
    scope
      .get(`/repos/throw-if-null/orfe/issues/${options.duplicateOfIssueNumber}`)
      .reply(options.duplicateTargetGetStatus ?? 404, options.duplicateTargetGetResponseBody ?? { message: 'Not Found' });
  }

  if (options.unmark) {
    scope
      .post('/graphql', (body: unknown) => matchesUnmarkIssueAsDuplicate(body, options.unmark!.duplicateId, options.unmark!.canonicalId))
      .reply(200, { data: { unmarkIssueAsDuplicate: { clientMutationId: null } } });
  }

  if (options.mark) {
    scope
      .post('/graphql', (body: unknown) => matchesMarkIssueAsDuplicate(body, options.mark!.duplicateId, options.mark!.canonicalId))
      .reply(200, { data: { markIssueAsDuplicate: { clientMutationId: null } } });
  }

  if (options.observedIssueState) {
    if (options.restUpdateBody) {
      scope.patch(`/repos/throw-if-null/orfe/issues/${options.issueNumber}`, options.restUpdateBody).reply(200, createIssueRestResponse(options.issueNumber, options.restUpdateBody));
    }

    scope
      .post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.issueNumber))
      .reply(200, { data: { repository: { issue: options.observedIssueState } } });
  }

  return scope;
}

test('listCommandNames exposes the agreed V1 command surface', () => {
  assert.deepEqual(listCommandNames(), COMMAND_NAMES);
});

test('runOrfeCore mints an auth token for the resolved caller bot', async () => {
  nock.disableNetConnect();

  try {
    const api = mockAuthTokenMintRequest({ repo: { owner: 'throw-if-null', name: 'orfe' } });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'auth token',
        input: {
          repo: 'throw-if-null/orfe',
        },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'auth token',
      repo: 'throw-if-null/orfe',
      data: {
        bot: 'greg',
        app_slug: 'GR3G-BOT',
        repo: 'throw-if-null/orfe',
        token: 'ghs_123',
        expires_at: '2026-04-06T12:00:00Z',
        auth_mode: 'github-app',
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore returns runtime info without caller, config, auth, or GitHub access', async () => {
  const result = await runOrfeCore(
    {
      callerName: '',
      command: 'runtime info',
      input: {},
      entrypoint: 'cli',
    },
    {
      loadRepoConfigImpl: async () => {
        throw new Error('loadRepoConfigImpl should not run');
      },
      loadAuthConfigImpl: async () => {
        throw new Error('loadAuthConfigImpl should not run');
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.command, 'runtime info');
  assert.equal(result.repo, undefined);
  const data = result.data as { orfe_version: string; entrypoint: string };
  assert.match(data.orfe_version, /^\d+\.\d+\.\d+/);
  assert.deepEqual(data, {
    orfe_version: data.orfe_version,
    entrypoint: 'cli',
  });
});

test('runOrfeCore rejects bot override input for auth token', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'auth token',
        input: { bot: 'unknown', repo: 'throw-if-null/orfe' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'invalid_usage');
      assert.equal(error.message, 'Command "auth token" does not accept input field "bot".');
      return true;
    },
  );
});

test('runOrfeCore fails clearly for auth token when the caller is unmapped', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Unknown Agent',
        command: 'auth token',
        input: { repo: 'throw-if-null/orfe' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'caller_name_unmapped');
      assert.match(error.message, /Caller name "Unknown Agent" is not mapped/);
      return true;
    },
  );
});

test('runOrfeCore fails clearly for auth token when the installation is missing', async () => {
  nock.disableNetConnect();

  try {
    const api = mockAuthTokenMintRequest({ installationStatus: 404 });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'auth token',
          input: { repo: 'throw-if-null/orfe' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'No GitHub App installation for throw-if-null/orfe was found for app GR3G-BOT.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore fails clearly for auth token when token minting is rejected', async () => {
  nock.disableNetConnect();

  try {
    const api = mockAuthTokenMintRequest({ tokenStatus: 403 });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'auth token',
          input: { repo: 'throw-if-null/orfe' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'Failed to mint an installation token for bot "greg" on throw-if-null/orfe.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore surfaces config failures for auth token clearly', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'auth token',
        input: { repo: 'throw-if-null/orfe' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => {
          throw new OrfeError('config_not_found', 'machine-local auth config not found at /tmp/auth.json.');
        },
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'config_not_found');
      assert.equal(error.message, 'machine-local auth config not found at /tmp/auth.json.');
      return true;
    },
  );
});

test('runOrfeCore reads project status for an issue and returns structured success output', async () => {
  nock.disableNetConnect();

  try {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                  createProjectItemNode({
                    id: 'PVTI_lAHOABCD1234',
                    projectId: 'PVT_project_1',
                    projectOwner: 'throw-if-null',
                    projectNumber: 1,
                    fields: [createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' })],
                    statusValue: createProjectStatusValueNode({
                      fieldId: 'PVTSSF_lAHOABCD1234',
                      fieldName: 'Status',
                      optionId: 'f75ad846',
                      name: 'In Progress',
                    }),
                  }),
                ]),
            },
          },
        },
      },
    });
    const fieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' }),
            ]),
          },
        },
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'project get-status',
        input: { item_type: 'issue', item_number: 13 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'project get-status',
      repo: 'throw-if-null/orfe',
      data: {
        project_owner: 'throw-if-null',
        project_number: 1,
        status_field_name: 'Status',
        status_field_id: 'PVTSSF_lAHOABCD1234',
        item_type: 'issue',
        item_number: 13,
        project_item_id: 'PVTI_lAHOABCD1234',
        status_option_id: 'f75ad846',
        status: 'In Progress',
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore paginates project items so later matching items are found', async () => {
  nock.disableNetConnect();

  try {
    const firstPageApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection(
                [
                  createProjectItemNode({
                    id: 'PVTI_elsewhere',
                    projectId: 'PVT_elsewhere',
                    projectOwner: 'throw-if-null',
                    projectNumber: 99,
                  }),
                ],
                { hasNextPage: true, endCursor: 'cursor-1' },
              ),
            },
          },
        },
      },
    });
    const secondPageApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      projectItemsCursor: 'cursor-1',
      includeAuth: false,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({
                  id: 'PVTI_lAHOABCD1234',
                  projectId: 'PVT_project_1',
                  projectOwner: 'throw-if-null',
                  projectNumber: 1,
                  statusValue: createProjectStatusValueNode({
                    fieldId: 'PVTSSF_lAHOABCD1234',
                    fieldName: 'Status',
                    optionId: 'f75ad846',
                    name: 'In Progress',
                  }),
                }),
              ]),
            },
          },
        },
      },
    });
    const fieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' }),
            ]),
          },
        },
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'project get-status',
        input: { item_type: 'issue', item_number: 13 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data, {
        project_owner: 'throw-if-null',
        project_number: 1,
        status_field_name: 'Status',
        status_field_id: 'PVTSSF_lAHOABCD1234',
        item_type: 'issue',
        item_number: 13,
        project_item_id: 'PVTI_lAHOABCD1234',
        status_option_id: 'f75ad846',
        status: 'In Progress',
      });
    }
    assert.equal(firstPageApi.isDone(), true);
    assert.equal(secondPageApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore paginates project fields so later matching fields are found', async () => {
  nock.disableNetConnect();

  try {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({
                  id: 'PVTI_lAHOABCD1234',
                  projectId: 'PVT_project_1',
                  projectOwner: 'throw-if-null',
                  projectNumber: 1,
                  statusValue: createProjectStatusValueNode({
                    fieldId: 'PVTSSF_lAHOABCD1234',
                    fieldName: 'Status',
                    optionId: 'f75ad846',
                    name: 'In Progress',
                  }),
                }),
              ]),
            },
          },
        },
      },
    });
    const firstFieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection(
              [createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' })],
              { hasNextPage: true, endCursor: 'fields-cursor-1' },
            ),
          },
        },
      },
    });
    const secondFieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      fieldsCursor: 'fields-cursor-1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' }),
            ]),
          },
        },
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'project get-status',
        input: { item_type: 'issue', item_number: 13 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data, {
        project_owner: 'throw-if-null',
        project_number: 1,
        status_field_name: 'Status',
        status_field_id: 'PVTSSF_lAHOABCD1234',
        item_type: 'issue',
        item_number: 13,
        project_item_id: 'PVTI_lAHOABCD1234',
        status_option_id: 'f75ad846',
        status: 'In Progress',
      });
    }
    assert.equal(itemApi.isDone(), true);
    assert.equal(firstFieldsApi.isDone(), true);
    assert.equal(secondFieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore reads project status for a pull request and returns structured success output', async () => {
  nock.disableNetConnect();

  try {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'pr',
      itemNumber: 9,
      graphqlResponseBody: {
        data: {
          repository: {
            pullRequest: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({
                  id: 'PVTI_pr1234',
                  projectId: 'PVT_project_1',
                  projectOwner: 'throw-if-null',
                  projectNumber: 1,
                  statusValue: createProjectStatusValueNode({
                    fieldId: 'PVTSSF_lAHOABCD1234',
                    fieldName: 'Status',
                    optionId: 'f75ad846',
                    name: 'In Progress',
                  }),
                }),
              ]),
            },
          },
        },
      },
    });
    const fieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' }),
            ]),
          },
        },
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'project get-status',
        input: { item_type: 'pr', item_number: 9 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'project get-status',
      repo: 'throw-if-null/orfe',
      data: {
        project_owner: 'throw-if-null',
        project_number: 1,
        status_field_name: 'Status',
        status_field_id: 'PVTSSF_lAHOABCD1234',
        item_type: 'pr',
        item_number: 9,
        project_item_id: 'PVTI_pr1234',
        status_option_id: 'f75ad846',
        status: 'In Progress',
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore fails clearly when the target issue is not on the configured project', async () => {
  nock.disableNetConnect();

  try {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                  createProjectItemNode({
                    id: 'PVTI_elsewhere',
                    projectId: 'PVT_elsewhere',
                    projectOwner: 'throw-if-null',
                    projectNumber: 99,
                  }),
                ]),
            },
          },
        },
      },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'project get-status',
          input: { item_type: 'issue', item_number: 13 },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'project_item_not_found');
        assert.equal(error.message, 'Issue #13 is not present on GitHub Project throw-if-null/1.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore fails clearly when the configured project is missing the Status field', async () => {
  nock.disableNetConnect();

  try {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                  createProjectItemNode({
                    id: 'PVTI_lAHOABCD1234',
                    projectId: 'PVT_project_1',
                    projectOwner: 'throw-if-null',
                    projectNumber: 1,
                    fields: [createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' })],
                  }),
                ]),
            },
          },
        },
      },
    });
    const fieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' }),
            ]),
          },
        },
      },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'project get-status',
          input: { item_type: 'issue', item_number: 13 },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'project_status_field_not_found');
        assert.equal(error.message, 'GitHub Project throw-if-null/1 has no single-select field named "Status".');
        return true;
      },
    );

    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps project get-status auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'project get-status',
          input: { item_type: 'issue', item_number: 13 },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'GitHub App authentication failed while reading project status for issue #13.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore supports explicit status field overrides for project get-status', async () => {
  nock.disableNetConnect();

  try {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      statusFieldName: 'Delivery',
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                  createProjectItemNode({
                    id: 'PVTI_lAHOABCD1234',
                    projectId: 'PVT_project_1',
                    projectOwner: 'throw-if-null',
                    projectNumber: 1,
                    fields: [createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' })],
                    statusValue: createProjectStatusValueNode({
                      fieldId: 'PVTSSF_delivery',
                      fieldName: 'Delivery',
                      optionId: 'f75ad847',
                      name: 'Shipped',
                    }),
                  }),
                ]),
            },
          },
        },
      },
    });
    const fieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' }),
            ]),
          },
        },
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'project get-status',
        input: { item_type: 'issue', item_number: 13, status_field_name: 'Delivery' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'project get-status',
      repo: 'throw-if-null/orfe',
      data: {
        project_owner: 'throw-if-null',
        project_number: 1,
        status_field_name: 'Delivery',
        status_field_id: 'PVTSSF_delivery',
        item_type: 'issue',
        item_number: 13,
        project_item_id: 'PVTI_lAHOABCD1234',
        status_option_id: 'f75ad847',
        status: 'Shipped',
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore sets project status for an issue and returns structured success output', async () => {
  nock.disableNetConnect();

  try {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({
                  id: 'PVTI_lAHOABCD1234',
                  projectId: 'PVT_project_1',
                  projectOwner: 'throw-if-null',
                  projectNumber: 1,
                  statusValue: createProjectStatusValueNode({
                    fieldId: 'PVTSSF_lAHOABCD1234',
                    fieldName: 'Status',
                    optionId: 'f75ad845',
                    name: 'Todo',
                  }),
                }),
              ]),
            },
          },
        },
      },
    });
    const fieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              {
                ...createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' }),
                options: [
                  { id: 'f75ad845', name: 'Todo' },
                  { id: 'f75ad846', name: 'In Progress' },
                  { id: 'f75ad847', name: 'Done' },
                ],
              },
            ]),
          },
        },
      },
    });
    const mutationApi = mockProjectStatusUpdateRequest({
      itemId: 'PVTI_lAHOABCD1234',
      fieldId: 'PVTSSF_lAHOABCD1234',
      optionId: 'f75ad846',
    });
    const observedItemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      includeAuth: false,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({
                  id: 'PVTI_lAHOABCD1234',
                  projectId: 'PVT_project_1',
                  projectOwner: 'throw-if-null',
                  projectNumber: 1,
                  statusValue: createProjectStatusValueNode({
                    fieldId: 'PVTSSF_lAHOABCD1234',
                    fieldName: 'Status',
                    optionId: 'f75ad846',
                    name: 'In Progress',
                  }),
                }),
              ]),
            },
          },
        },
      },
    });
    const observedFieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              {
                ...createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' }),
                options: [
                  { id: 'f75ad845', name: 'Todo' },
                  { id: 'f75ad846', name: 'In Progress' },
                  { id: 'f75ad847', name: 'Done' },
                ],
              },
            ]),
          },
        },
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'project set-status',
        input: { item_type: 'issue', item_number: 13, status: 'In Progress' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'project set-status',
      repo: 'throw-if-null/orfe',
      data: {
        project_owner: 'throw-if-null',
        project_number: 1,
        status_field_name: 'Status',
        status_field_id: 'PVTSSF_lAHOABCD1234',
        item_type: 'issue',
        item_number: 13,
        project_item_id: 'PVTI_lAHOABCD1234',
        status_option_id: 'f75ad846',
        status: 'In Progress',
        previous_status_option_id: 'f75ad845',
        previous_status: 'Todo',
        changed: true,
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
    assert.equal(mutationApi.isDone(), true);
    assert.equal(observedItemApi.isDone(), true);
    assert.equal(observedFieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore treats project set-status as an idempotent no-op when the requested status already matches', async () => {
  nock.disableNetConnect();

  try {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({
                  id: 'PVTI_lAHOABCD1234',
                  projectId: 'PVT_project_1',
                  projectOwner: 'throw-if-null',
                  projectNumber: 1,
                  statusValue: createProjectStatusValueNode({
                    fieldId: 'PVTSSF_lAHOABCD1234',
                    fieldName: 'Status',
                    optionId: 'f75ad846',
                    name: 'In Progress',
                  }),
                }),
              ]),
            },
          },
        },
      },
    });
    const fieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              {
                ...createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' }),
                options: [
                  { id: 'f75ad845', name: 'Todo' },
                  { id: 'f75ad846', name: 'In Progress' },
                ],
              },
            ]),
          },
        },
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'project set-status',
        input: { item_type: 'issue', item_number: 13, status: 'In Progress' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'project set-status',
      repo: 'throw-if-null/orfe',
      data: {
        project_owner: 'throw-if-null',
        project_number: 1,
        status_field_name: 'Status',
        status_field_id: 'PVTSSF_lAHOABCD1234',
        item_type: 'issue',
        item_number: 13,
        project_item_id: 'PVTI_lAHOABCD1234',
        status_option_id: 'f75ad846',
        status: 'In Progress',
        previous_status_option_id: 'f75ad846',
        previous_status: 'In Progress',
        changed: false,
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore fails clearly when project set-status targets an item outside the configured project', async () => {
  nock.disableNetConnect();

  try {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([]),
            },
          },
        },
      },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'project set-status',
          input: { item_type: 'issue', item_number: 13, status: 'In Progress' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'project_item_not_found');
        assert.equal(error.message, 'Issue #13 is not present on GitHub Project throw-if-null/1.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore fails clearly when project set-status receives an invalid status option', async () => {
  nock.disableNetConnect();

  try {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({
                  id: 'PVTI_lAHOABCD1234',
                  projectId: 'PVT_project_1',
                  projectOwner: 'throw-if-null',
                  projectNumber: 1,
                  statusValue: createProjectStatusValueNode({
                    fieldId: 'PVTSSF_lAHOABCD1234',
                    fieldName: 'Status',
                    optionId: 'f75ad845',
                    name: 'Todo',
                  }),
                }),
              ]),
            },
          },
        },
      },
    });
    const fieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              {
                ...createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' }),
                options: [
                  { id: 'f75ad845', name: 'Todo' },
                  { id: 'f75ad846', name: 'In Progress' },
                ],
              },
            ]),
          },
        },
      },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'project set-status',
          input: { item_type: 'issue', item_number: 13, status: 'Blocked' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'project_status_option_not_found');
        assert.equal(error.message, 'GitHub Project throw-if-null/1 field "Status" has no option named "Blocked".');
        return true;
      },
    );

    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps project set-status auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'project set-status',
          input: { item_type: 'issue', item_number: 13, status: 'In Progress' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'GitHub App authentication failed while setting project status for issue #13.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore supports explicit status field overrides for project set-status', async () => {
  nock.disableNetConnect();

  try {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      statusFieldName: 'Delivery',
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({
                  id: 'PVTI_lAHOABCD1234',
                  projectId: 'PVT_project_1',
                  projectOwner: 'throw-if-null',
                  projectNumber: 1,
                  statusValue: createProjectStatusValueNode({
                    fieldId: 'PVTSSF_delivery',
                    fieldName: 'Delivery',
                    optionId: 'f75ad847',
                    name: 'Queued',
                  }),
                }),
              ]),
            },
          },
        },
      },
    });
    const fieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              {
                ...createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' }),
                options: [
                  { id: 'f75ad847', name: 'Queued' },
                  { id: 'f75ad848', name: 'Shipped' },
                ],
              },
            ]),
          },
        },
      },
    });
    const mutationApi = mockProjectStatusUpdateRequest({
      itemId: 'PVTI_lAHOABCD1234',
      fieldId: 'PVTSSF_delivery',
      optionId: 'f75ad848',
    });
    const observedItemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      statusFieldName: 'Delivery',
      includeAuth: false,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({
                  id: 'PVTI_lAHOABCD1234',
                  projectId: 'PVT_project_1',
                  projectOwner: 'throw-if-null',
                  projectNumber: 1,
                  statusValue: createProjectStatusValueNode({
                    fieldId: 'PVTSSF_delivery',
                    fieldName: 'Delivery',
                    optionId: 'f75ad848',
                    name: 'Shipped',
                  }),
                }),
              ]),
            },
          },
        },
      },
    });
    const observedFieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              {
                ...createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' }),
                options: [
                  { id: 'f75ad847', name: 'Queued' },
                  { id: 'f75ad848', name: 'Shipped' },
                ],
              },
            ]),
          },
        },
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'project set-status',
        input: { item_type: 'issue', item_number: 13, status: 'Shipped', status_field_name: 'Delivery' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'project set-status',
      repo: 'throw-if-null/orfe',
      data: {
        project_owner: 'throw-if-null',
        project_number: 1,
        status_field_name: 'Delivery',
        status_field_id: 'PVTSSF_delivery',
        item_type: 'issue',
        item_number: 13,
        project_item_id: 'PVTI_lAHOABCD1234',
        status_option_id: 'f75ad848',
        status: 'Shipped',
        previous_status_option_id: 'f75ad847',
        previous_status: 'Queued',
        changed: true,
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
    assert.equal(mutationApi.isDone(), true);
    assert.equal(observedItemApi.isDone(), true);
    assert.equal(observedFieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore can be exercised directly with plain callerName data', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueGetRequest({ issueNumber: 14 });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue get',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        title: 'Build `orfe` foundation and runtime scaffolding',
        body: 'Issue body',
        state: 'open',
        state_reason: null,
        labels: ['needs-input'],
        assignees: ['greg'],
        html_url: 'https://github.com/throw-if-null/orfe/issues/14',
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps issue get not-found responses clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueGetRequest({
      issueNumber: 999,
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue get',
          input: { issue_number: 999 },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_not_found');
        assert.equal(error.message, 'Issue #999 was not found.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps issue get auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueGetRequest({
      issueNumber: 14,
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue get',
          input: { issue_number: 14 },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'GitHub App authentication failed while reading issue #14.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore reads a pull request and returns structured success output', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetRequest({ prNumber: 9 });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'pr get',
        input: { pr_number: 9 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'pr get',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: 'issues/orfe-13',
        base: 'main',
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps pr get not-found responses clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetRequest({
      prNumber: 999,
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr get',
          input: { pr_number: 999 },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_not_found');
        assert.equal(error.message, 'Pull request #999 was not found.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps pr get auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetRequest({
      prNumber: 9,
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr get',
          input: { pr_number: 9 },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'GitHub App authentication failed while reading pull request #9.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore reuses an existing pull request for pr get-or-create', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      existingPullRequests: [
        {
          number: 9,
          title: 'Design the `orfe` custom tool and CLI contract',
          body: 'PR body',
          state: 'open',
          draft: false,
          head: { ref: 'issues/orfe-13' },
          base: { ref: 'main' },
          html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        },
      ],
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'pr get-or-create',
        input: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'pr get-or-create',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        head: 'issues/orfe-13',
        base: 'main',
        draft: false,
        created: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore creates a pull request for pr get-or-create when none exists', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      existingPullRequests: [],
      createRequestBody: {
        head: 'issues/orfe-13',
        base: 'main',
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'Ref: #13',
        draft: true,
      },
      createResponseBody: {
        number: 10,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'Ref: #13',
        state: 'open',
        draft: true,
        head: { ref: 'issues/orfe-13' },
        base: { ref: 'main' },
        html_url: 'https://github.com/throw-if-null/orfe/pull/10',
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'pr get-or-create',
        input: {
          head: 'issues/orfe-13',
          title: 'Design the `orfe` custom tool and CLI contract',
          body: 'Ref: #13',
          draft: true,
        },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'pr get-or-create',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 10,
        html_url: 'https://github.com/throw-if-null/orfe/pull/10',
        head: 'issues/orfe-13',
        base: 'main',
        draft: true,
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore posts a top-level pull request comment and returns structured success output', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestCommentRequest({ prNumber: 9, body: 'Hello from orfe' });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'pr comment',
        input: { pr_number: 9, body: 'Hello from orfe' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'pr comment',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        comment_id: 123456,
        html_url: 'https://github.com/throw-if-null/orfe/pull/9#issuecomment-123456',
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore submits a pull request review and returns structured success output', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestSubmitReviewRequest({ prNumber: 9, body: 'Looks good', event: 'APPROVE' });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'pr submit-review',
        input: { pr_number: 9, event: 'approve', body: 'Looks good' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'pr submit-review',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        review_id: 555,
        event: 'approve',
        submitted: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore rejects invalid pr submit-review events clearly', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'pr submit-review',
        input: { pr_number: 9, event: 'dismiss', body: 'nope' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'invalid_input');
      assert.equal(error.message, 'Review event must be one of: approve, request-changes, comment.');
      return true;
    },
  );
});

test('runOrfeCore maps pr submit-review missing pull requests clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestSubmitReviewRequest({
      prNumber: 404,
      body: 'Looks good',
      event: 'APPROVE',
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr submit-review',
          input: { pr_number: 404, event: 'approve', body: 'Looks good' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_not_found');
        assert.equal(error.message, 'Pull request #404 was not found.');
        return true;
      },
    );

    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps pr submit-review auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestSubmitReviewRequest({
      prNumber: 9,
      body: 'Looks good',
      event: 'APPROVE',
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr submit-review',
          input: { pr_number: 9, event: 'approve', body: 'Looks good' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'GitHub App authentication failed while submitting a review on pull request #9.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps pr submit-review internal failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestSubmitReviewRequest({
      prNumber: 9,
      body: 'Looks good',
      event: 'APPROVE',
      status: 422,
      responseBody: { message: 'Validation Failed' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr submit-review',
          input: { pr_number: 9, event: 'approve', body: 'Looks good' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'internal_error');
        assert.equal(error.message, 'GitHub API request failed with status 422: Validation Failed');
        assert.equal(error.retryable, false);
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps pr comment not-found responses clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestCommentRequest({
      prNumber: 999,
      body: 'Hello from orfe',
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr comment',
          input: { pr_number: 999, body: 'Hello from orfe' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_not_found');
        assert.equal(error.message, 'Pull request #999 was not found.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps plain-issue targets for pr comment as not found', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestCommentRequest({
      prNumber: 14,
      body: 'Hello from orfe',
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr comment',
          input: { pr_number: 14, body: 'Hello from orfe' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_not_found');
        assert.equal(error.message, 'Pull request #14 was not found.');
        return true;
      },
    );

    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps pr comment auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestCommentRequest({
      prNumber: 9,
      body: 'Hello from orfe',
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr comment',
          input: { pr_number: 9, body: 'Hello from orfe' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'GitHub App authentication failed while commenting on pull request #9.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore surfaces pr comment validation failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestCommentRequest({
      prNumber: 9,
      body: 'Hello from orfe',
      status: 422,
      responseBody: { message: 'Validation Failed' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr comment',
          input: { pr_number: 9, body: 'Hello from orfe' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'internal_error');
        assert.equal(error.message, 'GitHub API request failed with status 422: Validation Failed');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore replies to a pull request review comment and returns structured success output', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestReplyRequest({ prNumber: 9, commentId: 123456, body: 'ack' });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'pr reply',
        input: { pr_number: 9, comment_id: 123456, body: 'ack' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'pr reply',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        comment_id: 123999,
        in_reply_to_comment_id: 123456,
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps pr reply missing pull requests clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestReplyRequest({
      prNumber: 404,
      commentId: 123456,
      body: 'ack',
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr reply',
          input: { pr_number: 404, comment_id: 123456, body: 'ack' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_not_found');
        assert.equal(error.message, 'Pull request #404 was not found.');
        return true;
      },
    );

    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps pr reply missing review comments clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestReplyRequest({
      prNumber: 9,
      commentId: 123456,
      body: 'ack',
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr reply',
          input: { pr_number: 9, comment_id: 123456, body: 'ack' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_not_found');
        assert.equal(error.message, 'Review comment #123456 was not found on pull request #9.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps pr reply auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestReplyRequest({
      prNumber: 9,
      commentId: 123456,
      body: 'ack',
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr reply',
          input: { pr_number: 9, comment_id: 123456, body: 'ack' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'GitHub App authentication failed while replying to review comment #123456 on pull request #9.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore rejects non-repliable pr reply targets clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestReplyRequest({
      prNumber: 9,
      commentId: 123456,
      body: 'ack',
      status: 422,
      responseBody: { message: 'Validation Failed' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr reply',
          input: { pr_number: 9, comment_id: 123456, body: 'ack' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_conflict');
        assert.equal(
          error.message,
          'GitHub rejected reply to review comment #123456 on pull request #9: Validation Failed',
        );
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore rejects ambiguous pr get-or-create matches clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      existingPullRequests: [
        {
          number: 9,
          title: 'First PR',
          body: 'PR body',
          state: 'open',
          draft: false,
          head: { ref: 'issues/orfe-13' },
          base: { ref: 'main' },
          html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        },
        {
          number: 10,
          title: 'Second PR',
          body: 'PR body',
          state: 'open',
          draft: true,
          head: { ref: 'issues/orfe-13' },
          base: { ref: 'main' },
          html_url: 'https://github.com/throw-if-null/orfe/pull/10',
        },
      ],
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr get-or-create',
          input: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_conflict');
        assert.equal(
          error.message,
          'Found 2 open pull requests for head "issues/orfe-13" and base "main" in throw-if-null/orfe.',
        );
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps pr get-or-create lookup auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      listStatus: 403,
      listResponseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr get-or-create',
          input: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(
          error.message,
          'GitHub App authentication failed while looking up pull requests for head "issues/orfe-13" and base "main".',
        );
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps pr get-or-create creation auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      existingPullRequests: [],
      createStatus: 403,
      createResponseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr get-or-create',
          input: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(
          error.message,
          'GitHub App authentication failed while creating a pull request for head "issues/orfe-13" and base "main".',
        );
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore surfaces pr get-or-create creation failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      existingPullRequests: [],
      createStatus: 422,
      createResponseBody: { message: 'Validation Failed' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'pr get-or-create',
          input: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'internal_error');
        assert.equal(error.message, 'GitHub pull request creation failed with status 422: Validation Failed');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore creates a generic issue and returns structured success output', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
        body: 'Body text',
        labels: ['needs-input'],
        assignees: ['greg'],
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue create',
        input: {
          title: 'New issue title',
          body: 'Body text',
          labels: ['needs-input'],
          assignees: ['greg'],
        },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps issue create auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueCreateRequest({
      requestBody: { title: 'New issue title' },
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue create',
          input: { title: 'New issue title' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'GitHub App authentication failed while creating an issue in throw-if-null/orfe.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps issue create missing repository failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueCreateRequest({
      repo: { owner: 'octo', name: 'missing' },
      requestBody: { title: 'New issue title' },
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue create',
          input: { title: 'New issue title', repo: 'octo/missing' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_not_found');
        assert.equal(error.message, 'Repository octo/missing was not found.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps issue create creation failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueCreateRequest({
      requestBody: { title: 'New issue title' },
      status: 422,
      responseBody: { message: 'Validation Failed' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue create',
          input: { title: 'New issue title' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'internal_error');
        assert.equal(error.message, 'GitHub issue creation failed with status 422: Validation Failed');
        assert.equal(error.retryable, false);
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore updates issue metadata and returns structured success output', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueUpdateRequest({
      issueNumber: 14,
      requestBody: {
        title: 'Updated title',
        body: 'Updated body',
        labels: ['bug', 'needs-input'],
        assignees: ['greg'],
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue update',
        input: {
          issue_number: 14,
          title: 'Updated title',
          body: 'Updated body',
          labels: ['bug', 'needs-input'],
          assignees: ['greg'],
        },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue update',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        title: 'Updated title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/14',
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore clears labels and assignees for issue update', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueUpdateRequest({
      issueNumber: 14,
      requestBody: {
        labels: [],
        assignees: [],
      },
      responseBody: {
        number: 14,
        title: 'Build `orfe` foundation and runtime scaffolding',
        body: 'Issue body',
        state: 'open',
        state_reason: null,
        labels: [],
        assignees: [],
        html_url: 'https://github.com/throw-if-null/orfe/issues/14',
      },
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue update',
        input: {
          issue_number: 14,
          clear_labels: true,
          clear_assignees: true,
        },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue update',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        title: 'Build `orfe` foundation and runtime scaffolding',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/14',
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps issue update not-found responses clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueUpdateRequest({
      issueNumber: 999,
      requestBody: { title: 'Updated title' },
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue update',
          input: { issue_number: 999, title: 'Updated title' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_not_found');
        assert.equal(error.message, 'Issue #999 was not found.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps issue update auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueUpdateRequest({
      issueNumber: 14,
      requestBody: { title: 'Updated title' },
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue update',
          input: { issue_number: 14, title: 'Updated title' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'GitHub App authentication failed while updating issue #14.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore rejects pull request targets for issue update clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueUpdateRequest({
      issueNumber: 46,
      requestBody: { title: 'Updated title' },
      issueGetResponseBody: {
        number: 46,
        title: 'Implement `orfe issue update`',
        body: 'PR body',
        state: 'open',
        state_reason: null,
        labels: [],
        assignees: [],
        html_url: 'https://github.com/throw-if-null/orfe/pull/46',
        pull_request: {
          url: 'https://api.github.com/repos/throw-if-null/orfe/pulls/46',
        },
      },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue update',
          input: { issue_number: 46, title: 'Updated title' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_conflict');
        assert.equal(error.message, 'Issue #46 is a pull request. issue update only supports issues.');
        return true;
      },
    );

    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore posts a generic issue comment and returns structured success output', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueCommentRequest({ issueNumber: 14, body: 'Hello from orfe' });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue comment',
        input: { issue_number: 14, body: 'Hello from orfe' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue comment',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        comment_id: 123456,
        html_url: 'https://github.com/throw-if-null/orfe/issues/14#issuecomment-123456',
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps issue comment not-found responses clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueCommentRequest({
      issueNumber: 999,
      body: 'Hello from orfe',
      issueGetStatus: 404,
      issueGetResponseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue comment',
          input: { issue_number: 999, body: 'Hello from orfe' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_not_found');
        assert.equal(error.message, 'Issue #999 was not found.');
        return true;
      },
    );

    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps issue comment auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueCommentRequest({
      issueNumber: 14,
      body: 'Hello from orfe',
      issueGetStatus: 403,
      issueGetResponseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue comment',
          input: { issue_number: 14, body: 'Hello from orfe' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'GitHub App authentication failed while commenting on issue #14.');
        return true;
      },
    );

    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore closes an issue with structured state metadata', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      restUpdateBody: { state: 'closed', state_reason: 'completed' },
      observedIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'COMPLETED',
      }),
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue set-state',
        input: { issue_number: 14, state: 'closed', state_reason: 'completed' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'completed',
        duplicate_of_issue_number: null,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore reopens an issue and clears duplicate metadata', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'DUPLICATE',
        duplicateOfIssueNumber: 7,
        duplicateOfId: 'I_7',
      }),
      unmark: { duplicateId: 'I_14', canonicalId: 'I_7' },
      restUpdateBody: { state: 'open' },
      observedIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue set-state',
        input: { issue_number: 14, state: 'open' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'open',
        state_reason: null,
        duplicate_of_issue_number: null,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore closes an issue as a duplicate and returns canonical issue metadata', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 7,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      canonicalIssueState: createIssueStateNode({ id: 'I_7', issueNumber: 7, state: 'OPEN' }),
      mark: { duplicateId: 'I_14', canonicalId: 'I_7' },
      observedIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'DUPLICATE',
        duplicateOfIssueNumber: 7,
        duplicateOfId: 'I_7',
      }),
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue set-state',
        input: { issue_number: 14, state: 'closed', state_reason: 'duplicate', duplicate_of: 7 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'duplicate',
        duplicate_of_issue_number: 7,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore treats matching issue set-state requests as no-ops', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'COMPLETED',
      }),
      includeGraphql: true,
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue set-state',
        input: { issue_number: 14, state: 'closed', state_reason: 'completed' },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'completed',
        duplicate_of_issue_number: null,
        changed: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps issue set-state missing duplicate target clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 999,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      canonicalIssueState: null,
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue set-state',
          input: { issue_number: 14, state: 'closed', state_reason: 'duplicate', duplicate_of: 999 },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_not_found');
        assert.equal(error.message, 'Duplicate target issue #999 was not found.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore rejects pull request duplicate targets for issue set-state clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 48,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      canonicalIssueState: null,
      duplicateTargetGetStatus: 200,
      duplicateTargetGetResponseBody: createIssueRestResponse(48, {
        title: 'Implement `orfe issue set-state`',
        html_url: 'https://github.com/throw-if-null/orfe/pull/48',
        pull_request: {
          url: 'https://api.github.com/repos/throw-if-null/orfe/pulls/48',
        },
      }),
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue set-state',
          input: { issue_number: 14, state: 'closed', state_reason: 'duplicate', duplicate_of: 48 },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_conflict');
        assert.equal(error.message, 'Duplicate target issue #48 is a pull request. --duplicate-of must reference an issue.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore maps issue set-state auth failures clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      issueGetStatus: 403,
      issueGetResponseBody: { message: 'Resource not accessible by integration' },
      includeGraphql: false,
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue set-state',
          input: { issue_number: 14, state: 'closed', state_reason: 'completed' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(error.message, 'GitHub App authentication failed while setting state for issue #14.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore rejects pull request targets for issue set-state clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateRequest({
      issueNumber: 46,
      currentIssueState: createIssueStateNode({ id: 'I_46', issueNumber: 46, state: 'OPEN' }),
      issueGetResponseBody: {
        number: 46,
        title: 'Implement `orfe issue set-state`',
        body: 'PR body',
        state: 'open',
        state_reason: null,
        labels: [],
        assignees: [],
        html_url: 'https://github.com/throw-if-null/orfe/pull/46',
        pull_request: {
          url: 'https://api.github.com/repos/throw-if-null/orfe/pulls/46',
        },
      },
      includeGraphql: false,
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue set-state',
          input: { issue_number: 46, state: 'closed', state_reason: 'completed' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_conflict');
        assert.equal(error.message, 'Issue #46 is a pull request. issue set-state only supports issues.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore re-targets duplicate issue set-state requests and reports changes', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 9,
      currentIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'DUPLICATE',
        duplicateOfIssueNumber: 7,
        duplicateOfId: 'I_7',
      }),
      canonicalIssueState: createIssueStateNode({ id: 'I_9', issueNumber: 9, state: 'OPEN' }),
      unmark: { duplicateId: 'I_14', canonicalId: 'I_7' },
      mark: { duplicateId: 'I_14', canonicalId: 'I_9' },
      observedIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'DUPLICATE',
        duplicateOfIssueNumber: 9,
        duplicateOfId: 'I_9',
      }),
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue set-state',
        input: { issue_number: 14, state: 'closed', state_reason: 'duplicate', duplicate_of: 9 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'duplicate',
        duplicate_of_issue_number: 9,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore treats matching duplicate issue set-state requests as no-ops', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 7,
      currentIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'DUPLICATE',
        duplicateOfIssueNumber: 7,
        duplicateOfId: 'I_7',
      }),
      canonicalIssueState: createIssueStateNode({ id: 'I_7', issueNumber: 7, state: 'OPEN' }),
    });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue set-state',
        input: { issue_number: 14, state: 'closed', state_reason: 'duplicate', duplicate_of: 7 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'duplicate',
        duplicate_of_issue_number: 7,
        changed: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore rejects pull request targets for issue comment clearly', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueCommentRequest({
      issueNumber: 46,
      body: 'Hello from orfe',
      issueGetResponseBody: {
        number: 46,
        title: 'Implement `orfe issue comment`',
        body: 'PR body',
        state: 'open',
        state_reason: null,
        labels: [],
        assignees: [],
        html_url: 'https://github.com/throw-if-null/orfe/pull/46',
        pull_request: {
          url: 'https://api.github.com/repos/throw-if-null/orfe/pulls/46',
        },
      },
    });

    await assert.rejects(
      runOrfeCore(
        {
          callerName: 'Greg',
          command: 'issue comment',
          input: { issue_number: 46, body: 'Hello from orfe' },
        },
        {
          loadRepoConfigImpl: async () => createRepoConfig(),
          loadAuthConfigImpl: async () => createAuthConfig(),
          githubClientFactory: createGitHubClientFactory(),
        },
      ),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_conflict');
        assert.equal(error.message, 'Issue #46 is a pull request. Use pr comment instead.');
        return true;
      },
    );

    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore rejects unmapped callers clearly', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Unknown Agent',
        command: 'issue get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'caller_name_unmapped');
      assert.match(error.message, /Caller name "Unknown Agent" is not mapped/);
      return true;
    },
  );
});

test('runOrfeCore rejects empty caller names clearly', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: '   ',
        command: 'issue get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'caller_name_missing');
      return true;
    },
  );
});

test('runOrfeCore rejects repo-local config failures before auth config loading succeeds', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue get',
        input: { issue_number: 14 },
      },
      {
        loadRepoConfigImpl: async () => {
          throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
        },
        loadAuthConfigImpl: async () => {
          throw new OrfeError('internal_error', 'auth config should not load');
        },
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'config_not_found');
      return true;
    },
  );
});

test('createRuntimeSnapshot validates machine-local auth mapping', async () => {
  await assert.rejects(
    createRuntimeSnapshot(
      {
        callerName: 'Greg',
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => ({
          configPath: '/tmp/auth.json',
          version: 1 as const,
          bots: {},
        }),
      },
    ),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'auth_failed');
      return true;
    },
  );
});

test('createRuntimeSnapshot proves auth config is separate from repo-local config', async () => {
  const snapshot = await createRuntimeSnapshot(
    {
      callerName: 'Greg',
    },
    {
      loadRepoConfigImpl: async () => createRepoConfig(),
      loadAuthConfigImpl: async () => createAuthConfig(),
    },
  );

  assert.equal(snapshot.repoConfig.configPath, '/tmp/.orfe/config.json');
  assert.equal(snapshot.authConfig.configPath, '/tmp/auth.json');
  assert.equal(snapshot.callerBot, 'greg');
});
