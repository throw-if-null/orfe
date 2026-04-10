import assert from 'node:assert/strict';
import nock from 'nock';
import test from 'node:test';

import { COMMAND_NAMES, getCommandContract } from '../src/command-contracts.js';
import { getCommandDefinition, listCommandNames, validateCommandInput } from '../src/command-registry.js';
import { OrfeError } from '../src/errors.js';
import { GitHubClientFactory } from '../src/github.js';
import { createRuntimeSnapshot, runOrfeCore } from '../src/core.js';

const UNIMPLEMENTED_COMMAND_NAMES = COMMAND_NAMES.filter(
  (commandName) =>
    commandName !== 'issue.get' &&
    commandName !== 'issue.create' &&
    commandName !== 'issue.update' &&
    commandName !== 'issue.comment' &&
    commandName !== 'issue.set-state',
);

function createRepoConfig() {
  return {
    configPath: '/tmp/.orfe/config.json',
    version: 1 as const,
    repository: {
      owner: 'throw-if-null',
      name: 'orfe',
      defaultBranch: 'main',
    },
    callerToGitHubRole: {
      Greg: 'greg',
    },
  };
}

function createAuthConfig() {
  return {
    configPath: '/tmp/auth.json',
    version: 1 as const,
    roles: {
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

test('issue.get pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('issue.get').successDataExample, {
    issue_number: 13,
    title: 'Design the `orfe` custom tool and CLI contract',
    body: '...',
    state: 'open',
    state_reason: null,
    labels: ['needs-input'],
    assignees: ['greg'],
    html_url: 'https://github.com/throw-if-null/orfe/issues/13',
  });
});

test('issue.create pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('issue.create').successDataExample, {
    issue_number: 21,
    title: 'New issue title',
    state: 'open',
    html_url: 'https://github.com/throw-if-null/orfe/issues/21',
    created: true,
  });
});

test('issue.update pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('issue.update').successDataExample, {
    issue_number: 13,
    title: 'Updated title',
    state: 'open',
    html_url: 'https://github.com/throw-if-null/orfe/issues/13',
    changed: true,
  });
});

test('issue.comment pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('issue.comment').successDataExample, {
    issue_number: 13,
    comment_id: 123456,
    html_url: 'https://github.com/throw-if-null/orfe/issues/13#issuecomment-123456',
    created: true,
  });
});

test('issue.set-state pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('issue.set-state').successDataExample, {
    issue_number: 13,
    state: 'closed',
    state_reason: 'completed',
    duplicate_of_issue_number: null,
    changed: true,
  });
});

test('pr.get pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('pr.get').successDataExample, {
    pr_number: 9,
    title: 'Design the `orfe` custom tool and CLI contract',
    body: '...',
    state: 'open',
    draft: false,
    head: 'issues/orfe-13',
    base: 'main',
    html_url: 'https://github.com/throw-if-null/orfe/pull/9',
  });
});

test('pr.get-or-create pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('pr.get-or-create').successDataExample, {
    pr_number: 9,
    html_url: 'https://github.com/throw-if-null/orfe/pull/9',
    head: 'issues/orfe-13',
    base: 'main',
    draft: false,
    created: false,
  });
});

test('pr.comment pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('pr.comment').successDataExample, {
    pr_number: 9,
    comment_id: 123456,
    html_url: 'https://github.com/throw-if-null/orfe/pull/9#issuecomment-123456',
    created: true,
  });
});

test('pr.submit-review pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('pr.submit-review').successDataExample, {
    pr_number: 9,
    review_id: 555,
    event: 'approve',
    submitted: true,
  });
});

test('pr.reply pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('pr.reply').successDataExample, {
    pr_number: 9,
    comment_id: 123999,
    in_reply_to_comment_id: 123456,
    created: true,
  });
});

test('project.get-status pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('project.get-status').successDataExample, {
    project_owner: 'throw-if-null',
    project_number: 1,
    status_field_name: 'Status',
    item_type: 'issue',
    item_number: 13,
    status: 'In Progress',
  });
});

test('project.set-status pins its exact JSON success contract', () => {
  assert.deepEqual(getCommandContract('project.set-status').successDataExample, {
    project_owner: 'throw-if-null',
    project_number: 1,
    status_field_name: 'Status',
    item_type: 'issue',
    item_number: 13,
    status: 'In Progress',
    previous_status: 'Todo',
    changed: true,
  });
});

test('every command definition uses the independently pinned success contract', () => {
  for (const commandName of COMMAND_NAMES) {
    const definition = getCommandDefinition(commandName);
    const contract = getCommandContract(commandName);

    assert.deepEqual(definition.successDataExample, contract.successDataExample);
    assert.ok(contract.validInput);
  }
});

test('runOrfeCore can be exercised directly with plain callerName data', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueGetRequest({ issueNumber: 14 });

    const result = await runOrfeCore(
      {
        callerName: 'Greg',
        command: 'issue.get',
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
      command: 'issue.get',
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

test('runOrfeCore maps issue.get not-found responses clearly', async () => {
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
          command: 'issue.get',
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

test('runOrfeCore maps issue.get auth failures clearly', async () => {
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
          command: 'issue.get',
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
        command: 'issue.create',
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
      command: 'issue.create',
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

test('runOrfeCore maps issue.create auth failures clearly', async () => {
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
          command: 'issue.create',
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

test('runOrfeCore maps issue.create missing repository failures clearly', async () => {
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
          command: 'issue.create',
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

test('runOrfeCore maps issue.create creation failures clearly', async () => {
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
          command: 'issue.create',
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
        command: 'issue.update',
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
      command: 'issue.update',
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

test('runOrfeCore clears labels and assignees for issue.update', async () => {
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
        command: 'issue.update',
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
      command: 'issue.update',
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

test('runOrfeCore maps issue.update not-found responses clearly', async () => {
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
          command: 'issue.update',
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

test('runOrfeCore maps issue.update auth failures clearly', async () => {
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
          command: 'issue.update',
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

test('runOrfeCore rejects pull request targets for issue.update clearly', async () => {
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
          command: 'issue.update',
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
        assert.equal(error.message, 'Issue #46 is a pull request. issue.update only supports issues.');
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
        command: 'issue.comment',
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
      command: 'issue.comment',
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

test('runOrfeCore maps issue.comment not-found responses clearly', async () => {
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
          command: 'issue.comment',
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

test('runOrfeCore maps issue.comment auth failures clearly', async () => {
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
          command: 'issue.comment',
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

test('validateCommandInput rejects invalid issue.set-state combinations clearly', () => {
  const definition = getCommandDefinition('issue.set-state');

  assert.throws(
    () =>
      validateCommandInput(definition, {
        issue_number: 14,
        state: 'open',
        state_reason: 'completed',
      }),
    /issue\.set-state only allows state_reason when --state closed is used\./,
  );

  assert.throws(
    () =>
      validateCommandInput(definition, {
        issue_number: 14,
        state: 'closed',
        duplicate_of: 7,
      }),
    /issue\.set-state only allows duplicate_of with state_reason=duplicate\./,
  );

  assert.throws(
    () =>
      validateCommandInput(definition, {
        issue_number: 14,
        state: 'closed',
        state_reason: 'duplicate',
      }),
    /issue\.set-state requires --duplicate-of when state_reason=duplicate\./,
  );

  assert.throws(
    () =>
      validateCommandInput(definition, {
        issue_number: 14,
        state: 'closed',
        state_reason: 'duplicate',
        duplicate_of: 14,
      }),
    /issue\.set-state cannot mark an issue as a duplicate of itself\./,
  );
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
        command: 'issue.set-state',
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
      command: 'issue.set-state',
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
        command: 'issue.set-state',
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
      command: 'issue.set-state',
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
        command: 'issue.set-state',
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
      command: 'issue.set-state',
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

test('runOrfeCore treats matching issue.set-state requests as no-ops', async () => {
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
        command: 'issue.set-state',
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
      command: 'issue.set-state',
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

test('runOrfeCore maps issue.set-state missing duplicate target clearly', async () => {
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
          command: 'issue.set-state',
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

test('runOrfeCore rejects pull request duplicate targets for issue.set-state clearly', async () => {
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
          command: 'issue.set-state',
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

test('runOrfeCore maps issue.set-state auth failures clearly', async () => {
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
          command: 'issue.set-state',
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

test('runOrfeCore rejects pull request targets for issue.set-state clearly', async () => {
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
          command: 'issue.set-state',
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
        assert.equal(error.message, 'Issue #46 is a pull request. issue.set-state only supports issues.');
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore re-targets duplicate issue.set-state requests and reports changes', async () => {
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
        command: 'issue.set-state',
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
      command: 'issue.set-state',
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

test('runOrfeCore treats matching duplicate issue.set-state requests as no-ops', async () => {
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
        command: 'issue.set-state',
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
      command: 'issue.set-state',
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

test('runOrfeCore rejects pull request targets for issue.comment clearly', async () => {
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
          command: 'issue.comment',
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
        assert.equal(error.message, 'Issue #46 is a pull request. Use pr.comment instead.');
        return true;
      },
    );

    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runOrfeCore returns the shared not-implemented stub error for every unimplemented leaf command', async (t) => {
  await Promise.all(
    UNIMPLEMENTED_COMMAND_NAMES.map((commandName) =>
      t.test(commandName, async () => {
        const contract = getCommandContract(commandName);

        await assert.rejects(
          runOrfeCore(
            {
              callerName: 'Greg',
              command: commandName,
              input: contract.validInput,
            },
            {
              loadRepoConfigImpl: async () => createRepoConfig(),
              loadAuthConfigImpl: async () => createAuthConfig(),
            },
          ),
          (error: unknown) => {
            assert(error instanceof OrfeError);
            assert.equal(error.code, 'not_implemented');
            assert.equal(error.message, `Command "${commandName}" is not implemented yet.`);
            return true;
          },
        );
      }),
    ),
  );
});

test('runOrfeCore rejects unmapped callers clearly', async () => {
  await assert.rejects(
    runOrfeCore(
      {
        callerName: 'Unknown Agent',
        command: 'issue.get',
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
        command: 'issue.get',
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
        command: 'issue.get',
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
          roles: {},
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
  assert.equal(snapshot.callerRole, 'greg');
});
