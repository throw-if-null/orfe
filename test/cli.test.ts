import assert from 'node:assert/strict';
import nock from 'nock';
import test from 'node:test';

import { getCommandDefinition, getGroupDefinitions } from '../src/command-registry.js';
import { getCommandContract } from '../src/command-contracts.js';
import { OrfeError } from '../src/errors.js';
import { GitHubClientFactory } from '../src/github.js';
import { parseInvocationForCli, runCli } from '../src/command.js';
import type { OrfeCommandGroup, OrfeCommandName } from '../src/types.js';

class MemoryStream {
  output = '';

  write(chunk: string): boolean {
    this.output += chunk;
    return true;
  }
}

const COMMAND_GROUPS: readonly OrfeCommandGroup[] = ['issue', 'pr', 'project'];
const ALL_COMMANDS: readonly OrfeCommandName[] = [
  'issue.get',
  'issue.create',
  'issue.update',
  'issue.comment',
  'issue.set-state',
  'pr.get',
  'pr.get-or-create',
  'pr.comment',
  'pr.submit-review',
  'pr.reply',
  'project.get-status',
  'project.set-status',
];

function createRuntimeDependencies() {
  return {
    loadRepoConfigImpl: async () => ({
      configPath: '/tmp/.orfe/config.json',
      version: 1 as const,
      repository: { owner: 'throw-if-null', name: 'orfe', defaultBranch: 'main' },
      callerToGitHubRole: { Greg: 'greg' },
      projects: {
        default: {
          owner: 'throw-if-null',
          projectNumber: 1,
          statusFieldName: 'Status',
        },
      },
    }),
    loadAuthConfigImpl: async () => ({
      configPath: '/tmp/auth.json',
      version: 1 as const,
      roles: {
        greg: {
          provider: 'github-app' as const,
          appId: 123,
          appSlug: 'GR3G-BOT',
          privateKeyPath: '/tmp/greg.pem',
        },
      },
    }),
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

function mockIssueSetStateRequest(options: {
  issueNumber: number;
  currentIssueState: Record<string, unknown>;
  restUpdateBody?: Record<string, unknown>;
  observedIssueState?: Record<string, unknown>;
  issueGetStatus?: number;
  issueGetResponseBody?: Record<string, unknown>;
  duplicateOfIssueNumber?: number;
  canonicalIssueState?: Record<string, unknown> | null;
  duplicateTargetGetStatus?: number;
  duplicateTargetGetResponseBody?: Record<string, unknown>;
  mark?: { duplicateId: string; canonicalId: string };
  unmark?: { duplicateId: string; canonicalId: string };
}) {
  const scope = nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${options.issueNumber}`)
    .reply(options.issueGetStatus ?? 200, options.issueGetResponseBody ?? createIssueRestResponse(options.issueNumber))
    .post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.issueNumber))
    .reply(200, { data: { repository: { issue: options.currentIssueState } } });

  if (options.duplicateOfIssueNumber !== undefined) {
    scope
      .post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.duplicateOfIssueNumber!))
      .reply(200, { data: { repository: { issue: options.canonicalIssueState ?? null } } });
  }

  if (options.duplicateOfIssueNumber !== undefined && options.canonicalIssueState === null) {
    scope
      .get(`/repos/throw-if-null/orfe/issues/${options.duplicateOfIssueNumber}`)
      .reply(options.duplicateTargetGetStatus ?? 404, options.duplicateTargetGetResponseBody ?? { message: 'Not Found' });
  }

  if (options.mark) {
    scope
      .post('/graphql', (body: unknown) => matchesMarkIssueAsDuplicate(body, options.mark!.duplicateId, options.mark!.canonicalId))
      .reply(200, { data: { markIssueAsDuplicate: { clientMutationId: null } } });
  }

  if (options.unmark) {
    scope
      .post('/graphql', (body: unknown) => {
        return (
          isObject(body) &&
          typeof body.query === 'string' &&
          body.query.includes('mutation UnmarkIssueAsDuplicate') &&
          isObject(body.variables) &&
          body.variables.duplicateId === options.unmark!.duplicateId &&
          body.variables.canonicalId === options.unmark!.canonicalId
        );
      })
      .reply(200, { data: { unmarkIssueAsDuplicate: { clientMutationId: null } } });
  }

  if (options.restUpdateBody) {
    scope.patch(`/repos/throw-if-null/orfe/issues/${options.issueNumber}`, options.restUpdateBody).reply(200, createIssueRestResponse(options.issueNumber, options.restUpdateBody));
  }

  if (options.observedIssueState) {
    scope
      .post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.issueNumber))
      .reply(200, { data: { repository: { issue: options.observedIssueState } } });
  }

  return scope;
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
  projectOwner: string;
  projectNumber: number;
  fields?: unknown[];
  statusValue?: unknown;
}) {
  return {
    id: options.id,
    project: {
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
}) {
  const statusFieldName = options.statusFieldName ?? 'Status';

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .post('/graphql', (body: unknown) =>
      matchesProjectStatusLookup(body, {
        itemType: options.itemType,
        itemNumber: options.itemNumber,
        statusFieldName,
      }),
    )
    .reply(
      options.graphqlStatus ?? 200,
      options.graphqlResponseBody ?? {
        data: {
          repository:
            options.itemType === 'issue'
              ? {
                  issue: {
                    projectItems: {
                      nodes: [],
                    },
                  },
                }
              : {
                  pullRequest: {
                    projectItems: {
                      nodes: [],
                    },
                  },
                },
        },
      },
    );
}

test('runCli renders root help', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['--help'], { stdout, stderr });

  assert.equal(exitCode, 0);
  assert.equal(stderr.output, '');
  assert.match(stdout.output, /orfe - generic GitHub operations runtime/);
  assert.match(stdout.output, /Command groups:/);
  assert.match(stdout.output, /Run `orfe <group> --help` for group-specific help\./);
});

test('runCli renders help for each command group', async (t) => {
  await Promise.all(
    COMMAND_GROUPS.map((group) =>
      t.test(`group ${group}`, async () => {
        const stdout = new MemoryStream();
        const stderr = new MemoryStream();

        const exitCode = await runCli([group, '--help'], { stdout, stderr });

        assert.equal(exitCode, 0);
        assert.equal(stderr.output, '');
        assert.match(stdout.output, new RegExp(`orfe ${group}`));
        assert.match(stdout.output, /Usage:/);
        assert.match(stdout.output, /Commands:/);

        for (const definition of getGroupDefinitions(group)) {
          assert.match(stdout.output, new RegExp(`${definition.leaf} - ${escapeForRegExp(definition.purpose)}`));
        }
      }),
    ),
  );
});

test('runCli renders leaf help for every agreed V1 command', async (t) => {
  await Promise.all(
    ALL_COMMANDS.map((commandName) =>
      t.test(commandName, async () => {
        const [group, leaf] = commandName.split('.') as [string, string];
        const stdout = new MemoryStream();
        const stderr = new MemoryStream();
        const definition = getCommandDefinition(commandName);

        const exitCode = await runCli([group, leaf, '--help'], { stdout, stderr });

        assert.equal(exitCode, 0);
        assert.equal(stderr.output, '');
        assert.match(stdout.output, new RegExp(`^${escapeForRegExp(commandName)}`, 'm'));
        assert.match(stdout.output, new RegExp(`Purpose: ${escapeForRegExp(definition.purpose)}`));
        assert.match(stdout.output, new RegExp(`Usage: ${escapeForRegExp(definition.usage)}`));
        assert.match(stdout.output, /Required options:/);
        assert.match(stdout.output, /Optional options:/);
        assert.match(stdout.output, new RegExp(`Success: ${escapeForRegExp(definition.successSummary)}`));
        assert.match(stdout.output, /Examples:/);
        assert.match(stdout.output, /JSON success shape example:/);
        assert.match(stdout.output, new RegExp(escapeForRegExp(JSON.stringify(definition.successDataExample))));
      }),
    ),
  );
});

test('runCli reports invalid usage for unknown commands', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'unknown'], { stdout, stderr });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Error: Unknown command "issue unknown"/);
  assert.match(stderr.output, /Usage: orfe issue <command> \[options]/);
  assert.match(stderr.output, /Example: orfe issue --help/);
  assert.match(stderr.output, /See: orfe issue --help/);
});

test('runCli requires caller identity for CLI mode', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'get', '--issue-number', '14'], { stdout, stderr, env: {} });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /CLI caller identity is required via --caller-name or ORFE_CALLER_NAME\./);
  assert.match(stderr.output, /See: orfe issue get --help/);
});

test('runCli prefers --caller-name over ORFE_CALLER_NAME', () => {
  const invocation = parseInvocationForCli(
    ['issue', 'get', '--issue-number', '14', '--caller-name', 'Jelena'],
    { ORFE_CALLER_NAME: 'Greg' },
  );

  assert.equal(invocation.kind, 'leaf');
  if (invocation.kind === 'leaf') {
    assert.equal(invocation.callerName, 'Jelena');
  }
});

test('runCli uses ORFE_CALLER_NAME and prints structured success JSON', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueGetRequest({ issueNumber: 14 });

    const exitCode = await runCli(['issue', 'get', '--issue-number', '14'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
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

test('runCli prints structured not-found failures for issue.get', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueGetRequest({
      issueNumber: 404,
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    const exitCode = await runCli(['issue', 'get', '--issue-number', '404'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'issue.get',
      error: {
        code: 'github_not_found',
        message: 'Issue #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured success JSON for issue.create', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

    const exitCode = await runCli(
      [
        'issue',
        'create',
        '--title',
        'New issue title',
        '--body',
        'Body text',
        '--label',
        'needs-input',
        '--assignee',
        'greg',
      ],
      {
        stdout,
        stderr,
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
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

test('runCli prints structured success JSON for pr.get', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetRequest({ prNumber: 9 });

    const exitCode = await runCli(['pr', 'get', '--pr-number', '9'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
      ok: true,
      command: 'pr.get',
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

test('runCli prints structured not-found failures for pr.get', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetRequest({
      prNumber: 404,
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    const exitCode = await runCli(['pr', 'get', '--pr-number', '404'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'pr.get',
      error: {
        code: 'github_not_found',
        message: 'Pull request #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured auth failures for pr.get', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetRequest({
      prNumber: 9,
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    const exitCode = await runCli(['pr', 'get', '--pr-number', '9'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'pr.get',
      error: {
        code: 'auth_failed',
        message: 'GitHub App authentication failed while reading pull request #9.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli reports missing required options for pr.get as usage errors', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['pr', 'get'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Missing required option "--pr-number"\./);
  assert.match(stderr.output, /Usage: orfe pr get --pr-number <number>/);
  assert.match(stderr.output, /See: orfe pr get --help/);
});

test('runCli prints structured config failures for pr.get', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['pr', 'get', '--pr-number', '9'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.deepEqual(JSON.parse(stderr.output), {
    ok: false,
    command: 'pr.get',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli prints structured success JSON for project.get-status', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: {
                nodes: [
                  createProjectItemNode({
                    id: 'PVTI_lAHOABCD1234',
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
                ],
              },
            },
          },
        },
      },
    });

    const exitCode = await runCli(['project', 'get-status', '--item-type', 'issue', '--item-number', '13'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
      ok: true,
      command: 'project.get-status',
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

test('runCli prints structured project-item-not-found failures for project.get-status', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: {
                nodes: [],
              },
            },
          },
        },
      },
    });

    const exitCode = await runCli(['project', 'get-status', '--item-type', 'issue', '--item-number', '13'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'project.get-status',
      error: {
        code: 'project_item_not_found',
        message: 'Issue #13 is not present on GitHub Project throw-if-null/1.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured missing-status-field failures for project.get-status', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: {
                nodes: [
                  createProjectItemNode({
                    id: 'PVTI_lAHOABCD1234',
                    projectOwner: 'throw-if-null',
                    projectNumber: 1,
                    fields: [createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' })],
                  }),
                ],
              },
            },
          },
        },
      },
    });

    const exitCode = await runCli(['project', 'get-status', '--item-type', 'issue', '--item-number', '13'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'project.get-status',
      error: {
        code: 'project_status_field_not_found',
        message: 'GitHub Project throw-if-null/1 has no single-select field named "Status".',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured auth failures for project.get-status', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
    });

    const exitCode = await runCli(['project', 'get-status', '--item-type', 'issue', '--item-number', '13'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'project.get-status',
      error: {
        code: 'auth_failed',
        message: 'GitHub App authentication failed while reading project status for issue #13.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured config failures for project.get-status', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['project', 'get-status', '--item-type', 'issue', '--item-number', '13'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.deepEqual(JSON.parse(stderr.output), {
    ok: false,
    command: 'project.get-status',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli prints structured auth failures for issue.create', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueCreateRequest({
      requestBody: { title: 'New issue title' },
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    const exitCode = await runCli(['issue', 'create', '--title', 'New issue title'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'issue.create',
      error: {
        code: 'auth_failed',
        message: 'GitHub App authentication failed while creating an issue in throw-if-null/orfe.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured repository-not-found failures for issue.create', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueCreateRequest({
      repo: { owner: 'octo', name: 'missing' },
      requestBody: { title: 'New issue title' },
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    const exitCode = await runCli(['issue', 'create', '--title', 'New issue title', '--repo', 'octo/missing'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'issue.create',
      error: {
        code: 'github_not_found',
        message: 'Repository octo/missing was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured creation failures for issue.create', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueCreateRequest({
      requestBody: { title: 'New issue title' },
      status: 422,
      responseBody: { message: 'Validation Failed' },
    });

    const exitCode = await runCli(['issue', 'create', '--title', 'New issue title'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'issue.create',
      error: {
        code: 'internal_error',
        message: 'GitHub issue creation failed with status 422: Validation Failed',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured success JSON for issue.update', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

    const exitCode = await runCli(
      [
        'issue',
        'update',
        '--issue-number',
        '14',
        '--title',
        'Updated title',
        '--body',
        'Updated body',
        '--label',
        'bug',
        '--label',
        'needs-input',
        '--assignee',
        'greg',
      ],
      {
        stdout,
        stderr,
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
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

test('runCli prints structured not-found failures for issue.update', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueUpdateRequest({
      issueNumber: 404,
      requestBody: { title: 'Updated title' },
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    const exitCode = await runCli(['issue', 'update', '--issue-number', '404', '--title', 'Updated title'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'issue.update',
      error: {
        code: 'github_not_found',
        message: 'Issue #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured pull-request boundary failures for issue.update', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

    const exitCode = await runCli(['issue', 'update', '--issue-number', '46', '--title', 'Updated title'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'issue.update',
      error: {
        code: 'github_conflict',
        message: 'Issue #46 is a pull request. issue.update only supports issues.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured success JSON for issue.comment', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueCommentRequest({ issueNumber: 14, body: 'Hello from orfe' });

    const exitCode = await runCli(['issue', 'comment', '--issue-number', '14', '--body', 'Hello from orfe'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
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

test('runCli formats core invalid_usage errors as CLI usage failures for issue.update', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'update', '--issue-number', '14'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /issue\.update requires at least one mutation option\./);
  assert.match(stderr.output, /Usage: orfe issue update --issue-number <number>/);
  assert.match(stderr.output, /See: orfe issue update --help/);
});

test('runCli rejects conflicting issue.update clear and replacement options', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'update', '--issue-number', '14', '--label', 'bug', '--clear-labels'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /does not allow labels together with --clear-labels/);
  assert.match(stderr.output, /Usage: orfe issue update --issue-number <number>/);
  assert.match(stderr.output, /See: orfe issue update --help/);
});

test('runCli prints structured config failures for issue.update', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'update', '--issue-number', '14', '--title', 'Updated title'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.deepEqual(JSON.parse(stderr.output), {
    ok: false,
    command: 'issue.update',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli prints structured not-found failures for issue.comment', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueCommentRequest({
      issueNumber: 404,
      body: 'Hello from orfe',
      issueGetStatus: 404,
      issueGetResponseBody: { message: 'Not Found' },
    });

    const exitCode = await runCli(['issue', 'comment', '--issue-number', '404', '--body', 'Hello from orfe'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'issue.comment',
      error: {
        code: 'github_not_found',
        message: 'Issue #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured pull-request boundary failures for issue.comment', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

    const exitCode = await runCli(['issue', 'comment', '--issue-number', '46', '--body', 'Hello from orfe'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'issue.comment',
      error: {
        code: 'github_conflict',
        message: 'Issue #46 is a pull request. Use pr.comment instead.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured success JSON for issue.set-state', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

    const exitCode = await runCli(['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'completed'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
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

test('runCli prints structured success JSON for duplicate issue.set-state', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      duplicateOfIssueNumber: 7,
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

    const exitCode = await runCli(
      ['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'duplicate', '--duplicate-of', '7'],
      {
        stdout,
        stderr,
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
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

test('runCli prints structured not-found failures for issue.set-state duplicate targets', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      duplicateOfIssueNumber: 999,
      canonicalIssueState: null,
    });

    const exitCode = await runCli(
      ['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'duplicate', '--duplicate-of', '999'],
      {
        stdout,
        stderr,
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'issue.set-state',
      error: {
        code: 'github_not_found',
        message: 'Duplicate target issue #999 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured pull-request boundary failures for duplicate issue.set-state targets', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      duplicateOfIssueNumber: 48,
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

    const exitCode = await runCli(
      ['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'duplicate', '--duplicate-of', '48'],
      {
        stdout,
        stderr,
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'issue.set-state',
      error: {
        code: 'github_conflict',
        message: 'Duplicate target issue #48 is a pull request. --duplicate-of must reference an issue.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured pull-request boundary failures for issue.set-state', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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
    });

    const exitCode = await runCli(['issue', 'set-state', '--issue-number', '46', '--state', 'closed', '--state-reason', 'completed'], {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.output, '');
    assert.deepEqual(JSON.parse(stderr.output), {
      ok: false,
      command: 'issue.set-state',
      error: {
        code: 'github_conflict',
        message: 'Issue #46 is a pull request. issue.set-state only supports issues.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured config failures for issue.set-state', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'set-state', '--issue-number', '14', '--state', 'closed', '--state-reason', 'completed'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.deepEqual(JSON.parse(stderr.output), {
    ok: false,
    command: 'issue.set-state',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli formats core invalid_usage errors as CLI usage failures for issue.comment', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'comment', '--issue-number', '14', '--body', '   '], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Option "body" must be a non-empty string\./);
  assert.match(stderr.output, /Usage: orfe issue comment --issue-number <number> --body <text>/);
  assert.match(stderr.output, /Example: orfe issue comment --issue-number 14 --body "hello" --caller-name Greg/);
  assert.match(stderr.output, /See: orfe issue comment --help/);
});

test('runCli prints structured config failures for issue.comment', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'comment', '--issue-number', '14', '--body', 'Hello from orfe'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.deepEqual(JSON.parse(stderr.output), {
    ok: false,
    command: 'issue.comment',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli prints structured config failures for issue.get', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'get', '--issue-number', '14'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.deepEqual(JSON.parse(stderr.output), {
    ok: false,
    command: 'issue.get',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli formats core invalid_usage errors as CLI usage failures', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'set-state', '--issue-number', '14', '--state', 'open', '--state-reason', 'completed'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /state_reason/);
  assert.match(stderr.output, /Usage: orfe issue set-state/);
  assert.match(stderr.output, /Example: orfe issue set-state --issue-number 14 --state closed --state-reason completed --caller-name Greg/);
  assert.match(stderr.output, /See: orfe issue set-state --help/);
});

test('runCli reports malformed numeric CLI option values as usage errors', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'get', '--issue-number', 'nope', '--caller-name', 'Greg'], {
    stdout,
    stderr,
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /^Error: Option "--issue-number" expects an integer\./);
  assert.match(stderr.output, /Usage: orfe issue get --issue-number <number>/);
  assert.match(stderr.output, /Example: orfe issue get --issue-number 14 --caller-name Greg/);
  assert.match(stderr.output, /See: orfe issue get --help/);
});

test('runCli reports malformed enum CLI option values as usage errors', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(
    ['pr', 'submit-review', '--pr-number', '9', '--event', 'nope', '--body', 'ok', '--caller-name', 'Greg'],
    {
      stdout,
      stderr,
    },
  );

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /^Error: Option "--event" must be one of: approve, request-changes, comment\./);
  assert.match(stderr.output, /Usage: orfe pr submit-review --pr-number <number> --event <approve\|request-changes\|comment>/);
  assert.match(stderr.output, /Example: orfe pr submit-review --pr-number 9 --event approve --body "Looks good" --caller-name Greg/);
  assert.match(stderr.output, /See: orfe pr submit-review --help/);
});

test('runCli reports malformed repo overrides as usage errors', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'get', '--issue-number', '14', '--repo', 'bad', '--caller-name', 'Greg'], {
    stdout,
    stderr,
    ...createRuntimeDependencies(),
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Repository must be in "owner\/name" format\./);
  assert.match(stderr.output, /See: orfe issue get --help/);
});

test('command contracts expose a JSON success shape for every V1 command', () => {
  for (const commandName of ALL_COMMANDS) {
    const contract = getCommandContract(commandName);
    assert.equal(typeof contract.successDataExample, 'object');
    assert.ok(Object.keys(contract.successDataExample).length > 0);
  }
});

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
