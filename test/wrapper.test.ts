import assert from 'node:assert/strict';
import path from 'node:path';
import nock from 'nock';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { GitHubClientFactory } from '../src/github.js';
import { COMMANDS } from '../src/commands/index.js';
import { createHelpCommandSuccessData, createHelpRootSuccessData } from '../src/commands/help/definition.js';
import type { OrfeCoreRequest, SuccessResponse } from '../src/types.js';
import { executeOrfeTool, resolveCallerNameFromContext } from '../src/wrapper.js';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoConfigPath = path.join(workspaceRoot, '.orfe', 'config.json');

function createRepoConfig() {
  return {
    configPath: repoConfigPath,
    version: 1 as const,
    repository: { owner: 'throw-if-null', name: 'orfe', defaultBranch: 'main' },
    callerToBot: { Greg: 'greg' },
  };
}

function createRepoConfigWithDefaultProject() {
  return {
    ...createRepoConfig(),
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
        appId: 123,
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

function mockAuthTokenMintRequest() {
  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' });
}

function mockIssueGetRequest(issueNumber: number) {
  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${issueNumber}`)
    .reply(200, {
      number: issueNumber,
      title: 'Build `orfe` foundation and runtime scaffolding',
      body: 'Issue body',
      state: 'open',
      state_reason: null,
      labels: [{ name: 'needs-input' }],
      assignees: [{ login: 'greg' }],
      html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
    });
}

function mockIssueUpdateRequest(issueNumber: number, requestBody: Record<string, unknown>) {
  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${issueNumber}`)
    .reply(200, {
      number: issueNumber,
      title: 'Updated title',
      body: 'Updated body',
      state: 'open',
      state_reason: null,
      labels: [{ name: 'bug' }],
      assignees: [{ login: 'greg' }],
      html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
    })
    .patch(`/repos/throw-if-null/orfe/issues/${issueNumber}`, requestBody)
    .reply(200, {
      number: issueNumber,
      title: 'Updated title',
      body: 'Updated body',
      state: 'open',
      state_reason: null,
      labels: [{ name: 'bug' }],
      assignees: [{ login: 'greg' }],
      html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
    });
}

function mockIssueCreateRequest(requestBody: Record<string, unknown>) {
  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .post('/repos/throw-if-null/orfe/issues', requestBody)
    .reply(201, {
      number: 21,
      node_id: 'I_kwDOOrfeIssue21',
      title: requestBody.title,
      body: requestBody.body ?? '',
      state: 'open',
      state_reason: null,
      labels: ((requestBody.labels as string[] | undefined) ?? []).map((name) => ({ name })),
      assignees: ((requestBody.assignees as string[] | undefined) ?? []).map((login) => ({ login })),
      html_url: 'https://github.com/throw-if-null/orfe/issues/21',
    });
}

function renderIssueBodyContractMarker() {
  return '<!-- orfe-body-contract: issue/formal-work-item@1.0.0 -->';
}

function renderPrBodyContractMarker() {
  return '<!-- orfe-body-contract: pr/implementation-ready@1.0.0 -->';
}

function mockPullRequestGetRequest(prNumber: number) {
  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(200, {
      number: prNumber,
      title: 'Design the `orfe` custom tool and CLI contract',
      body: 'PR body',
      state: 'open',
      draft: false,
      head: { ref: 'issues/orfe-13' },
      base: { ref: 'main' },
      html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
     });
}

function mockPullRequestGetOrCreateRequest(options: {
  head: string;
  base?: string;
  existingPullRequests?: Record<string, unknown>[];
  createRequestBody?: Record<string, unknown>;
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
    .reply(200, options.existingPullRequests ?? []);

  if (options.createRequestBody || options.createResponseBody) {
    scope
      .post('/repos/throw-if-null/orfe/pulls', options.createRequestBody ?? {
        head,
        base,
        title: 'Design the `orfe` custom tool and CLI contract',
        draft: false,
      })
      .reply(
        201,
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

function mockPullRequestCommentRequest(prNumber: number, body: string) {
  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(200, {
      number: prNumber,
      title: 'Design the `orfe` custom tool and CLI contract',
      body: 'PR body',
      state: 'open',
      draft: false,
      head: { ref: 'issues/orfe-13' },
      base: { ref: 'main' },
      html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
    })
    .post(`/repos/throw-if-null/orfe/issues/${prNumber}/comments`, { body })
    .reply(201, {
      id: 123456,
      html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}#issuecomment-123456`,
      });
}

function mockPullRequestReplyRequest(prNumber: number, commentId: number, body: string) {
  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(200, {
      number: prNumber,
      title: 'Design the `orfe` custom tool and CLI contract',
      body: 'PR body',
      state: 'open',
      draft: false,
      head: { ref: 'issues/orfe-13' },
      base: { ref: 'main' },
      html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
    })
    .post(`/repos/throw-if-null/orfe/pulls/${prNumber}/comments/${commentId}/replies`, { body })
    .reply(201, {
      id: 123999,
      in_reply_to_id: commentId,
    });
}

function mockPullRequestSubmitReviewRequest(
  prNumber: number,
  body: string,
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
) {
  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(200, {
      number: prNumber,
      title: 'Design the `orfe` custom tool and CLI contract',
      body: 'PR body',
      state: 'open',
      draft: false,
      head: { ref: 'issues/orfe-13' },
      base: { ref: 'main' },
      html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
    })
    .post(`/repos/throw-if-null/orfe/pulls/${prNumber}/reviews`, { body, event })
    .reply(200, {
      id: 555,
    });
}

function createProjectStatusFieldNode(options: { id: string; name: string; options?: Array<{ id: string; name: string }> }) {
  return {
    __typename: 'ProjectV2SingleSelectField',
    id: options.id,
    name: options.name,
    options: options.options ?? [],
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

function createProjectItemsConnection(nodes: unknown[]) {
  return {
    nodes,
    pageInfo: {
      hasNextPage: false,
      endCursor: null,
    },
  };
}

function createProjectFieldsConnection(nodes: unknown[]) {
  return {
    nodes,
    pageInfo: {
      hasNextPage: false,
      endCursor: null,
    },
  };
}

function createProjectItemNode(options: {
  id: string;
  projectId?: string;
  projectOwner: string;
  projectNumber: number;
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
    },
    fieldValueByName: options.statusValue ?? null,
  };
}

function matchesProjectByOwnerAndNumber(body: unknown, options: { projectOwner: string; projectNumber: number }): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'query' in body &&
    typeof (body as { query?: unknown }).query === 'string' &&
    (body as { query: string }).query.includes('query ProjectByOwnerAndNumber') &&
    'variables' in body &&
    typeof (body as { variables?: unknown }).variables === 'object' &&
    (body as { variables: { login?: unknown; number?: unknown } }).variables.login === options.projectOwner &&
    (body as { variables: { login?: unknown; number?: unknown } }).variables.number === options.projectNumber
  );
}

function matchesProjectAddItem(body: unknown, options: { projectId: string; contentId: string }): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'query' in body &&
    typeof (body as { query?: unknown }).query === 'string' &&
    (body as { query: string }).query.includes('mutation AddProjectItem') &&
    'variables' in body &&
    typeof (body as { variables?: unknown }).variables === 'object' &&
    (body as { variables: { projectId?: unknown; contentId?: unknown } }).variables.projectId === options.projectId &&
    (body as { variables: { projectId?: unknown; contentId?: unknown } }).variables.contentId === options.contentId
  );
}

test('resolveCallerNameFromContext accepts a string agent name', () => {
  assert.equal(resolveCallerNameFromContext({ agent: 'Greg' }), 'Greg');
});

test('resolveCallerNameFromContext accepts context.agent.name', () => {
  assert.equal(resolveCallerNameFromContext({ agent: { name: 'Jelena' } }), 'Jelena');
});

test('executeOrfeTool reads caller identity from context.agent and passes plain callerName to core', async () => {
  let capturedRequest: OrfeCoreRequest | undefined;
  let receivedAgentInCore = false;

  const result = await executeOrfeTool(
    {
      command: 'issue get',
      issue_number: 14,
    },
    {
      agent: { name: 'Greg', role: 'implementation-owner' },
      cwd: '/tmp/repo',
    },
    {
      runOrfeCoreImpl: async (request) => {
        capturedRequest = request;
        receivedAgentInCore = 'agent' in (request as unknown as Record<string, unknown>);

        return {
          ok: true,
          command: 'issue get',
          repo: 'throw-if-null/orfe',
          data: { issue_number: 14 },
        } satisfies SuccessResponse<Record<string, unknown>>;
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    command: 'issue get',
    repo: 'throw-if-null/orfe',
    data: { issue_number: 14 },
  });
  assert.deepEqual(capturedRequest, {
    callerName: 'Greg',
    command: 'issue get',
    input: { issue_number: 14 },
    entrypoint: 'opencode-plugin',
    cwd: '/tmp/repo',
    logger: capturedRequest?.logger,
  });
  assert.equal(typeof capturedRequest?.logger?.error, 'function');
  assert.equal(capturedRequest?.logger?.level, 'error');
  assert.equal(receivedAgentInCore, false);
});

test('executeOrfeTool returns runtime info through the shared success envelope without caller context', async () => {
  const result = await executeOrfeTool(
    {
      command: 'runtime info',
    },
    {},
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
  if (result.ok) {
    assert.equal(result.command, 'runtime info');
    assert.equal(result.repo, undefined);
    assert.match(String((result.data as { orfe_version: string }).orfe_version), /^\d+\.\d+\.\d+/);
    assert.deepEqual(result.data, {
      orfe_version: (result.data as { orfe_version: string }).orfe_version,
      entrypoint: 'opencode-plugin',
    });
  }
});

test('executeOrfeTool returns root help through the shared success envelope without caller context', async () => {
  const result = await executeOrfeTool(
    {
      command: 'help',
    },
    {},
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
  if (result.ok) {
    assert.equal(result.command, 'help');
    assert.equal(result.repo, undefined);
    assert.deepEqual(result.data, createHelpRootSuccessData(COMMANDS));
  }
});

test('executeOrfeTool returns targeted command help through the shared success envelope without caller context', async () => {
  const result = await executeOrfeTool(
    {
      command: 'help',
      command_name: 'issue get',
    },
    {},
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
  if (result.ok) {
    assert.equal(result.command, 'help');
    assert.equal(result.repo, undefined);
    assert.deepEqual(result.data, createHelpCommandSuccessData(COMMANDS, 'issue get'));
  }
});

test('executeOrfeTool returns representative targeted help across issue, pr, and project commands', async () => {
  for (const commandName of ['issue get', 'pr get-or-create', 'project set-status'] as const) {
    const result = await executeOrfeTool(
      {
        command: 'help',
        command_name: commandName,
      },
      {},
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
    if (result.ok) {
      assert.deepEqual(result.data, createHelpCommandSuccessData(COMMANDS, commandName));
    }
  }
});

test('executeOrfeTool returns the shared success envelope for issue get', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueGetRequest(14);

    const result = await executeOrfeTool(
      {
        command: 'issue get',
        issue_number: 14,
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
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

test('executeOrfeTool returns the shared success envelope for issue update', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueUpdateRequest(14, {
      title: 'Updated title',
      labels: ['bug'],
    });

    const result = await executeOrfeTool(
      {
        command: 'issue update',
        issue_number: 14,
        title: 'Updated title',
        labels: ['bug'],
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
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

test('executeOrfeTool returns the shared success envelope for issue create', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueCreateRequest({
      title: 'New issue title',
      body: 'Body text',
      labels: ['needs-input'],
      assignees: ['greg'],
    });

    const result = await executeOrfeTool(
      {
        command: 'issue create',
        title: 'New issue title',
        body: 'Body text',
        labels: ['needs-input'],
        assignees: ['greg'],
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
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

test('executeOrfeTool returns project assignment details for issue create when explicitly requested', async () => {
  nock.disableNetConnect();

  try {
    const issueApi = mockIssueCreateRequest({
      title: 'New issue title',
    });
    const api = nock('https://api.github.com')
      .post('/graphql', (body: unknown) => matchesProjectByOwnerAndNumber(body, { projectOwner: 'throw-if-null', projectNumber: 1 }))
      .reply(200, {
        data: {
          organization: {
            projectV2: {
              id: 'PVT_project_1',
            },
          },
          user: null,
        },
      })
      .post('/graphql', (body: unknown) => matchesProjectAddItem(body, { projectId: 'PVT_project_1', contentId: 'I_kwDOOrfeIssue21' }))
      .reply(200, {
        data: {
          addProjectV2ItemById: {
            item: {
              id: 'PVTI_lAHOABCD1234',
            },
          },
        },
      });

    const result = await executeOrfeTool(
      {
        command: 'issue create',
        title: 'New issue title',
        add_to_project: true,
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
      },
      {
        loadRepoConfigImpl: async () => createRepoConfigWithDefaultProject(),
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
        project_assignment: {
          project_owner: 'throw-if-null',
          project_number: 1,
          project_item_id: 'PVTI_lAHOABCD1234',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('executeOrfeTool returns partial-failure details for issue create project assignment errors', async () => {
  nock.disableNetConnect();

  try {
    const issueApi = mockIssueCreateRequest({
      title: 'New issue title',
    });
    const api = nock('https://api.github.com')
      .post('/graphql', (body: unknown) => matchesProjectByOwnerAndNumber(body, { projectOwner: 'throw-if-null', projectNumber: 1 }))
      .reply(200, {
        data: {
          organization: {
            projectV2: {
              id: 'PVT_project_1',
            },
          },
          user: null,
        },
      })
      .post('/graphql', (body: unknown) => matchesProjectAddItem(body, { projectId: 'PVT_project_1', contentId: 'I_kwDOOrfeIssue21' }))
      .reply(403, { message: 'Resource not accessible by integration' });

    const result = await executeOrfeTool(
      {
        command: 'issue create',
        title: 'New issue title',
        add_to_project: true,
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
      },
      {
        loadRepoConfigImpl: async () => createRepoConfigWithDefaultProject(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: false,
      command: 'issue create',
      error: {
        code: 'auth_failed',
        message:
          'Issue #21 was created, but adding it to GitHub Project throw-if-null/1 failed: GitHub App authentication failed while adding issue #21 to a GitHub Project.',
        retryable: false,
        details: {
          stage: 'project_add',
          created_issue: {
            issue_number: 21,
            title: 'New issue title',
            state: 'open',
            html_url: 'https://github.com/throw-if-null/orfe/issues/21',
            created: true,
          },
          project_owner: 'throw-if-null',
          project_number: 1,
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('executeOrfeTool validates issue bodies through body contracts before create', async () => {
  nock.disableNetConnect();

  try {
    const issueBody = [
      '## Problem / context',
      '',
      'Need deterministic validation for issue bodies.',
      '',
      '## Desired outcome',
      '',
      'Issue bodies validate against declarative contracts.',
      '',
      '## Scope',
      '',
      '### In scope',
      '- declarative contracts',
      '',
      '### Out of scope',
      '- executable plugins',
      '',
      '## Acceptance criteria',
      '',
      '- [ ] contracts load from .orfe/contracts',
      '',
      '## Docs impact',
      '',
      '- Docs impact: add new durable docs',
      '',
      '## ADR needed?',
      '',
      '- ADR needed: yes',
    ].join('\n');

    const api = mockIssueCreateRequest({
      title: 'New issue title',
      body: `${issueBody}\n\n${renderIssueBodyContractMarker()}`,
    });

    const result = await executeOrfeTool(
      {
        command: 'issue create',
        title: 'New issue title',
        body: issueBody,
        body_contract: 'formal-work-item@1.0.0',
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(result.ok, true);
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('executeOrfeTool returns the shared success envelope for pr get', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetRequest(9);

    const result = await executeOrfeTool(
      {
        command: 'pr get',
        pr_number: 9,
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
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

test('executeOrfeTool returns the shared success envelope for pr get-or-create', async () => {
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

    const result = await executeOrfeTool(
      {
        command: 'pr get-or-create',
        head: 'issues/orfe-13',
        title: 'Design the `orfe` custom tool and CLI contract',
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
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

test('executeOrfeTool validates PR bodies through body contracts before create', async () => {
  nock.disableNetConnect();

  try {
    const prBody = [
      'Ref: #59',
      '',
      '## Summary',
      '',
      '- add body-contract support',
      '',
      '## Verification',
      '',
      '- `npm test` ✅',
      '- `npm run lint` ✅',
      '- `npm run typecheck` ✅',
      '- `npm run build` ✅',
      '',
      '## Docs / ADR / debt',
      '',
      '- docs updated: yes',
      '- ADR updated: yes',
      '- debt updated: yes',
      '- details: updated docs and added ADR',
      '',
      '## Risks / follow-ups',
      '',
      '- richer generation is follow-up work',
    ].join('\n');

    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-59',
      existingPullRequests: [],
      createRequestBody: {
        head: 'issues/orfe-59',
        base: 'main',
        title: 'Introduce versioned body-contract support',
        body: `${prBody}\n\n${renderPrBodyContractMarker()}`,
        draft: false,
      },
      createResponseBody: {
        number: 59,
        title: 'Introduce versioned body-contract support',
        body: `${prBody}\n\n${renderPrBodyContractMarker()}`,
        state: 'open',
        draft: false,
        head: { ref: 'issues/orfe-59' },
        base: { ref: 'main' },
        html_url: 'https://github.com/throw-if-null/orfe/pull/59',
      },
    });

    const result = await executeOrfeTool(
      {
        command: 'pr get-or-create',
        head: 'issues/orfe-59',
        title: 'Introduce versioned body-contract support',
        body: prBody,
        body_contract: 'implementation-ready@1.0.0',
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(result.ok, true);
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('executeOrfeTool returns structured PR validation output', async () => {
  nock.disableNetConnect();

  try {
    const result = await executeOrfeTool(
      {
        command: 'pr validate',
        body: 'Ref: #58\n\nCloses: #58',
        body_contract: 'implementation-ready@1.0.0',
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'pr validate',
      repo: 'throw-if-null/orfe',
      data: {
        valid: false,
        contract: {
          artifact_type: 'pr',
          contract_name: 'implementation-ready',
          contract_version: '1.0.0',
        },
        contract_source: 'explicit',
        errors: [
          {
            kind: 'matched_forbidden_pattern',
            scope: 'body',
            pattern: '(?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+',
            message:
              'Body contract validation failed: body matched forbidden pattern (?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+.',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Summary',
            message: 'Body contract validation failed: missing required section "Summary".',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Verification',
            message: 'Body contract validation failed: missing required section "Verification".',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Docs / ADR / debt',
            message: 'Body contract validation failed: missing required section "Docs / ADR / debt".',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Risks / follow-ups',
            message: 'Body contract validation failed: missing required section "Risks / follow-ups".',
          },
        ],
      },
    });
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('executeOrfeTool returns structured issue validation output', async () => {
  nock.disableNetConnect();

  try {
    const result = await executeOrfeTool(
      {
        command: 'issue validate',
        body: [
          '## Problem / context',
          '',
          'Need deterministic issue-body validation.',
          '',
          '## Desired outcome',
          '',
          'Issue bodies validate against a versioned contract.',
          '',
          '## Scope',
          '',
          '### In scope',
          '- declarative contracts',
          '',
          '### Out of scope',
          '- executable plugins',
          '',
          '## Acceptance criteria',
          '',
          '- [ ] contracts load from .orfe/contracts',
          '',
          '## Docs impact',
          '',
          '- Docs impact: update existing docs',
          '- Details: update docs/orfe/spec.md',
          '',
          '## ADR needed?',
          '',
          '- ADR needed: no',
          '- Details: covered by ADR 0009',
          '',
          '## Dependencies / sequencing notes',
          '',
          '- depends on #59',
          '',
          '## Risks / open questions / non-goals',
          '',
          '- keep repo-specific structure out of runtime logic',
        ].join('\n'),
        body_contract: 'formal-work-item@1.0.0',
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
      },
      {
        loadRepoConfigImpl: async () => createRepoConfig(),
        loadAuthConfigImpl: async () => createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      command: 'issue validate',
      repo: 'throw-if-null/orfe',
      data: {
        valid: true,
        contract: {
          artifact_type: 'issue',
          contract_name: 'formal-work-item',
          contract_version: '1.0.0',
        },
        contract_source: 'explicit',
        normalized_body: [
          '## Problem / context',
          '',
          'Need deterministic issue-body validation.',
          '',
          '## Desired outcome',
          '',
          'Issue bodies validate against a versioned contract.',
          '',
          '## Scope',
          '',
          '### In scope',
          '- declarative contracts',
          '',
          '### Out of scope',
          '- executable plugins',
          '',
          '## Acceptance criteria',
          '',
          '- [ ] contracts load from .orfe/contracts',
          '',
          '## Docs impact',
          '',
          '- Docs impact: update existing docs',
          '- Details: update docs/orfe/spec.md',
          '',
          '## ADR needed?',
          '',
          '- ADR needed: no',
          '- Details: covered by ADR 0009',
          '',
          '## Dependencies / sequencing notes',
          '',
          '- depends on #59',
          '',
          '## Risks / open questions / non-goals',
          '',
          '- keep repo-specific structure out of runtime logic',
          '',
          renderIssueBodyContractMarker(),
        ].join('\n'),
        errors: [],
      },
    });
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('executeOrfeTool returns structured config failures for issue validate when config path is invalid', async () => {
  const missingConfigPath = path.join(workspaceRoot, 'missing-issue-validate-config.json');

  const result = await executeOrfeTool(
    {
      command: 'issue validate',
      body: [
        '## Problem / context',
        '',
        'Need deterministic issue-body validation.',
        '',
        '## Desired outcome',
        '',
        'Issue bodies validate against a versioned contract.',
      ].join('\n'),
      body_contract: 'formal-work-item@1.0.0',
      config: missingConfigPath,
    },
    {
      agent: 'Greg',
      cwd: workspaceRoot,
    },
  );

  assert.deepEqual(result, {
    ok: false,
    command: 'issue validate',
    error: {
      code: 'config_not_found',
      message: `repo-local config not found at ${missingConfigPath}.`,
      retryable: false,
    },
  });
});

test('executeOrfeTool returns the shared success envelope for pr comment', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestCommentRequest(9, 'Hello from orfe');

    const result = await executeOrfeTool(
      {
        command: 'pr comment',
        pr_number: 9,
        body: 'Hello from orfe',
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
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

test('executeOrfeTool returns the shared success envelope for pr submit-review', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestSubmitReviewRequest(9, 'Looks good', 'APPROVE');

    const result = await executeOrfeTool(
      {
        command: 'pr submit-review',
        pr_number: 9,
        event: 'approve',
        body: 'Looks good',
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
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

test('executeOrfeTool returns the shared success envelope for pr reply', async () => {
  nock.disableNetConnect();

  try {
    const api = mockPullRequestReplyRequest(9, 123456, 'ack');

    const result = await executeOrfeTool(
      {
        command: 'pr reply',
        pr_number: 9,
        comment_id: 123456,
        body: 'ack',
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
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

test('executeOrfeTool returns the shared success envelope for project get-status', async () => {
  nock.disableNetConnect();

  try {
    const api = nock('https://api.github.com')
      .get('/repos/throw-if-null/orfe/installation')
      .reply(200, { id: 42 })
      .post('/app/installations/42/access_tokens')
      .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
      .post('/graphql', (body: unknown) => {
        return (
          typeof body === 'object' &&
          body !== null &&
          'query' in body &&
          typeof (body as { query?: unknown }).query === 'string' &&
          (body as { query: string }).query.includes('query ProjectStatusForIssue')
        );
      })
      .reply(200, {
        data: {
          repository: {
            issue: {
              projectItems: {
                nodes: [
                  {
                    id: 'PVTI_lAHOABCD1234',
                    project: {
                      id: 'PVT_project_1',
                      number: 1,
                      owner: {
                        login: 'throw-if-null',
                      },
                    },
                    fieldValueByName: {
                      __typename: 'ProjectV2ItemFieldSingleSelectValue',
                      optionId: 'f75ad846',
                      name: 'In Progress',
                      field: {
                        __typename: 'ProjectV2SingleSelectField',
                        id: 'PVTSSF_lAHOABCD1234',
                        name: 'Status',
                      },
                    },
                  },
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
              },
            },
          },
        },
      })
      .post('/graphql', (body: unknown) => {
        return (
          typeof body === 'object' &&
          body !== null &&
          'query' in body &&
          typeof (body as { query?: unknown }).query === 'string' &&
          (body as { query: string }).query.includes('query ProjectStatusFields')
        );
      })
      .reply(200, {
        data: {
          node: {
            fields: {
              nodes: [
                {
                  __typename: 'ProjectV2SingleSelectField',
                  id: 'PVTSSF_lAHOABCD1234',
                  name: 'Status',
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      });

    const result = await executeOrfeTool(
      {
        command: 'project get-status',
        item_type: 'issue',
        item_number: 13,
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
      },
      {
        loadRepoConfigImpl: async () => createRepoConfigWithDefaultProject(),
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
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('executeOrfeTool returns the shared success envelope for project set-status', async () => {
  nock.disableNetConnect();

  try {
    const api = nock('https://api.github.com')
      .get('/repos/throw-if-null/orfe/installation')
      .reply(200, { id: 42 })
      .post('/app/installations/42/access_tokens')
      .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
      .post('/graphql', (body: unknown) => {
        return (
          typeof body === 'object' &&
          body !== null &&
          'query' in body &&
          typeof (body as { query?: unknown }).query === 'string' &&
          (body as { query: string }).query.includes('query ProjectStatusForIssue')
        );
      })
      .reply(200, {
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
      })
      .post('/graphql', (body: unknown) => {
        return (
          typeof body === 'object' &&
          body !== null &&
          'query' in body &&
          typeof (body as { query?: unknown }).query === 'string' &&
          (body as { query: string }).query.includes('query ProjectStatusFields')
        );
      })
      .reply(200, {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              createProjectStatusFieldNode({
                id: 'PVTSSF_lAHOABCD1234',
                name: 'Status',
                options: [
                  { id: 'f75ad845', name: 'Todo' },
                  { id: 'f75ad846', name: 'In Progress' },
                ],
              }),
            ]),
          },
        },
      })
      .post('/graphql', (body: unknown) => {
        return (
          typeof body === 'object' &&
          body !== null &&
          'query' in body &&
          typeof (body as { query?: unknown }).query === 'string' &&
          (body as { query: string }).query.includes('mutation UpdateProjectStatus')
        );
      })
      .reply(200, {
        data: {
          updateProjectV2ItemFieldValue: {
            clientMutationId: null,
          },
        },
      })
      .post('/graphql', (body: unknown) => {
        return (
          typeof body === 'object' &&
          body !== null &&
          'query' in body &&
          typeof (body as { query?: unknown }).query === 'string' &&
          (body as { query: string }).query.includes('query ProjectStatusForIssue')
        );
      })
      .reply(200, {
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
      })
      .post('/graphql', (body: unknown) => {
        return (
          typeof body === 'object' &&
          body !== null &&
          'query' in body &&
          typeof (body as { query?: unknown }).query === 'string' &&
          (body as { query: string }).query.includes('query ProjectStatusFields')
        );
      })
      .reply(200, {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              createProjectStatusFieldNode({
                id: 'PVTSSF_lAHOABCD1234',
                name: 'Status',
                options: [
                  { id: 'f75ad845', name: 'Todo' },
                  { id: 'f75ad846', name: 'In Progress' },
                ],
              }),
            ]),
          },
        },
      });

    const result = await executeOrfeTool(
      {
        command: 'project set-status',
        item_type: 'issue',
        item_number: 13,
        status: 'In Progress',
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
      },
      {
        loadRepoConfigImpl: async () => createRepoConfigWithDefaultProject(),
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
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('executeOrfeTool rejects missing caller context clearly', async () => {
  const result = await executeOrfeTool(
    {
      command: 'issue get',
      issue_number: 14,
    },
    {},
  );

  assert.deepEqual(result, {
    ok: false,
    command: 'issue get',
    error: {
      code: 'caller_context_missing',
      message: 'OpenCode caller context is missing.',
      retryable: false,
    },
  });
});

test('executeOrfeTool still rejects missing caller context for caller-mapped commands', async () => {
  const result = await executeOrfeTool(
    {
      command: 'issue get',
      issue_number: 14,
    },
    {},
  );

  assert.deepEqual(result, {
    ok: false,
    command: 'issue get',
    error: {
      code: 'caller_context_missing',
      message: 'OpenCode caller context is missing.',
      retryable: false,
    },
  });
});

test('executeOrfeTool resolves auth token from context.agent and returns shared success envelope', async () => {
  nock.disableNetConnect();

  try {
    const api = mockAuthTokenMintRequest();

    const result = await executeOrfeTool(
      {
        command: 'auth token',
        repo: 'throw-if-null/orfe',
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
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

test('executeOrfeTool rejects bot override input for auth token', async () => {
  const result = await executeOrfeTool(
    {
      command: 'auth token',
      bot: 'greg',
      repo: 'throw-if-null/orfe',
    },
    {
      agent: 'Greg',
      cwd: '/tmp/repo',
    },
  );

  assert.deepEqual(result, {
    ok: false,
    command: 'auth token',
    error: {
      code: 'invalid_usage',
      message: 'Command "auth token" does not accept input field "bot".',
      retryable: false,
    },
  });
});

test('executeOrfeTool rejects caller_name from tool input', async () => {
  const result = await executeOrfeTool(
    {
      command: 'issue get',
      caller_name: 'Greg',
      issue_number: 14,
    },
    {
      agent: 'Greg',
    },
  );

  assert.deepEqual(result, {
    ok: false,
    command: 'issue get',
    error: {
      code: 'invalid_usage',
      message: 'Tool input does not accept caller_name; caller identity comes from context.agent.',
      retryable: false,
    },
  });
});
