import assert from 'node:assert/strict';
import nock from 'nock';
import test from 'node:test';

import { GitHubClientFactory } from '../src/github.js';
import type { OrfeCoreRequest, SuccessResponse } from '../src/types.js';
import { executeOrfeTool, resolveCallerNameFromContext } from '../src/wrapper.js';

function createGitHubClientFactory() {
  return new GitHubClientFactory({
    readFileImpl: async () => 'private-key',
    jwtFactory: () => 'jwt-token',
  });
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
      command: 'issue.get',
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
          command: 'issue.get',
          repo: 'throw-if-null/orfe',
          data: { issue_number: 14 },
        } satisfies SuccessResponse<Record<string, unknown>>;
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    command: 'issue.get',
    repo: 'throw-if-null/orfe',
    data: { issue_number: 14 },
  });
  assert.deepEqual(capturedRequest, {
    callerName: 'Greg',
    command: 'issue.get',
    input: { issue_number: 14 },
    cwd: '/tmp/repo',
  });
  assert.equal(receivedAgentInCore, false);
});

test('executeOrfeTool returns the shared success envelope for issue.get', async () => {
  nock.disableNetConnect();

  try {
    const api = mockIssueGetRequest(14);

    const result = await executeOrfeTool(
      {
        command: 'issue.get',
        issue_number: 14,
      },
      {
        agent: 'Greg',
        cwd: '/tmp/repo',
      },
      {
        loadRepoConfigImpl: async () => ({
          configPath: '/tmp/.orfe/config.json',
          version: 1,
          repository: { owner: 'throw-if-null', name: 'orfe', defaultBranch: 'main' },
          callerToGitHubRole: { Greg: 'greg' },
        }),
        loadAuthConfigImpl: async () => ({
          configPath: '/tmp/auth.json',
          version: 1,
          roles: {
            greg: {
              provider: 'github-app',
              appId: 123,
              appSlug: 'GR3G-BOT',
              privateKeyPath: '/tmp/greg.pem',
            },
          },
        }),
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

test('executeOrfeTool rejects missing caller context clearly', async () => {
  const result = await executeOrfeTool(
    {
      command: 'issue.get',
      issue_number: 14,
    },
    {},
  );

  assert.deepEqual(result, {
    ok: false,
    command: 'issue.get',
    error: {
      code: 'caller_context_missing',
      message: 'OpenCode caller context is missing.',
      retryable: false,
    },
  });
});

test('executeOrfeTool rejects caller_name from tool input', async () => {
  const result = await executeOrfeTool(
    {
      command: 'issue.get',
      caller_name: 'Greg',
      issue_number: 14,
    },
    {
      agent: 'Greg',
    },
  );

  assert.deepEqual(result, {
    ok: false,
    command: 'issue.get',
    error: {
      code: 'invalid_usage',
      message: 'Tool input does not accept caller_name; caller identity comes from context.agent.',
      retryable: false,
    },
  });
});
