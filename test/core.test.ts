import assert from 'node:assert/strict';
import nock from 'nock';
import test from 'node:test';

import { COMMAND_NAMES, getCommandContract } from '../src/command-contracts.js';
import { getCommandDefinition, listCommandNames } from '../src/command-registry.js';
import { OrfeError } from '../src/errors.js';
import { GitHubClientFactory } from '../src/github.js';
import { createRuntimeSnapshot, runOrfeCore } from '../src/core.js';

const UNIMPLEMENTED_COMMAND_NAMES = COMMAND_NAMES.filter(
  (commandName) => commandName !== 'issue.get' && commandName !== 'issue.update' && commandName !== 'issue.comment',
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
