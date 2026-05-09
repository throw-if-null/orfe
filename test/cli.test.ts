import assert from 'node:assert/strict';
import nock from 'nock';
import { describe, test } from 'vitest';

import { mockAuthTokenMintRequest } from '../src/commands/auth/token/mocks/github.js';
import {
  createIssueRestResponse,
  createIssueStateNode,
  mockIssueCommentRequest,
  mockIssueCreateRequest,
  mockIssueGetRequest,
  mockIssueSetStateDuplicateRequest,
  mockIssueSetStateRequest,
  mockIssueUpdateRequest,
} from '../src/commands/issue/mocks/github.js';
import {
  mockPullRequestCommentRequest,
  mockPullRequestGetOrCreateRequest,
  mockPullRequestGetRequest,
  mockPullRequestReplyRequest,
  mockPullRequestSubmitReviewRequest,
  mockPullRequestUpdateRequest,
} from '../src/commands/pr/mocks/github.js';
import {
  createProjectFieldsConnection,
  createProjectItemNode,
  createProjectItemsConnection,
  createProjectLookupResponse,
  createProjectStatusFieldNode,
  createProjectStatusValueNode,
  mockProjectAddItemRequest,
  mockProjectGetStatusRequest,
  mockProjectLookupRequest,
  mockProjectStatusFieldsRequest,
  mockProjectStatusUpdateRequest,
} from '../src/commands/project/mocks/github.js';
import { createHelpCommandSuccessData, createHelpRootSuccessData } from '../src/commands/help/definition.js';
import { getCommandDefinition, getGroupDefinitions, listCommandDefinitions, listCommandGroups, listCommandNames } from '../src/commands/registry/index.js';
import { OrfeError } from '../src/errors.js';
import { parseInvocationForCli, runCli } from '../src/command.js';
import { MemoryStream, createGitHubClientFactory, createRuntimeDependencies, readPackageVersion, repoConfigPath } from './support/cli-test.js';
import { renderIssueBodyContractMarker, renderPrBodyContractMarker } from './support/runtime-fixtures.js';

const COMMAND_GROUPS = listCommandGroups();
const ALL_COMMANDS = listCommandNames();

test('runCli renders root help', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['--help'], { stdout, stderr });

  assert.equal(exitCode, 0);
  assert.equal(stderr.output, '');
  assert.match(stdout.output, /orfe - generic GitHub operations runtime/);
  assert.match(stdout.output, /Command groups:/);
  assert.match(stdout.output, /orfe --version/);
  assert.match(stdout.output, /Run `orfe <group> --help` for group-specific help\./);
});

test('runCli treats commandless invocation as the root help noop path', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli([], { stdout, stderr });

  assert.equal(exitCode, 0);
  assert.equal(stderr.output, '');
  assert.match(stdout.output, /orfe - generic GitHub operations runtime/);
  assert.match(stdout.output, /Command groups:/);
  assert.match(stdout.output, /orfe --version/);
});

test('runCli prints the package version for --version without caller, config, auth, or GitHub access', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();
  const packageVersion = await readPackageVersion();

  nock.disableNetConnect();

  try {
    const exitCode = await runCli(['--version'], {
      stdout,
      stderr,
      env: {},
      loadRepoConfigImpl: async () => {
        throw new Error('loadRepoConfigImpl should not run');
      },
      loadAuthConfigImpl: async () => {
        throw new Error('loadAuthConfigImpl should not run');
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.match(packageVersion, /^\d+\.\d+\.\d+/);
    assert.equal(stdout.output, `${packageVersion}\n`);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints runtime info without caller, config, auth, or GitHub access', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();
  const packageVersion = await readPackageVersion();

  nock.disableNetConnect();

  try {
    const exitCode = await runCli(['runtime', 'info'], {
      stdout,
      stderr,
      env: {},
      loadRepoConfigImpl: async () => {
        throw new Error('loadRepoConfigImpl should not run');
      },
      loadAuthConfigImpl: async () => {
        throw new Error('loadAuthConfigImpl should not run');
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
      ok: true,
      command: 'runtime info',
      data: {
        orfe_version: packageVersion,
        entrypoint: 'cli',
      },
    });
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured root help for the runtime help command without caller, config, auth, or GitHub access', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const exitCode = await runCli(['help'], {
      stdout,
      stderr,
      env: {},
      loadRepoConfigImpl: async () => {
        throw new Error('loadRepoConfigImpl should not run');
      },
      loadAuthConfigImpl: async () => {
        throw new Error('loadAuthConfigImpl should not run');
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
      ok: true,
      command: 'help',
      data: createHelpRootSuccessData(listCommandDefinitions()),
    });
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints targeted structured help for the requested command', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const exitCode = await runCli(['help', '--command-name', 'issue get'], {
      stdout,
      stderr,
      env: {},
      loadRepoConfigImpl: async () => {
        throw new Error('loadRepoConfigImpl should not run');
      },
      loadAuthConfigImpl: async () => {
        throw new Error('loadAuthConfigImpl should not run');
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
      ok: true,
      command: 'help',
      data: createHelpCommandSuccessData(listCommandDefinitions(), 'issue get'),
    });
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints representative targeted structured help for issue, pr, and project commands', async () => {
  nock.disableNetConnect();

  try {
    for (const commandName of ['issue get', 'pr update', 'project set-status'] as const) {
      const stdout = new MemoryStream();
      const stderr = new MemoryStream();

      const exitCode = await runCli(['help', '--command-name', commandName], {
        stdout,
        stderr,
        env: {},
        loadRepoConfigImpl: async () => {
          throw new Error('loadRepoConfigImpl should not run');
        },
        loadAuthConfigImpl: async () => {
          throw new Error('loadAuthConfigImpl should not run');
        },
      });

      assert.equal(exitCode, 0);
      assert.equal(stderr.output, '');
      assert.deepEqual(JSON.parse(stdout.output), {
        ok: true,
        command: 'help',
        data: createHelpCommandSuccessData(listCommandDefinitions(), commandName),
      });
    }
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli reports help-command usage errors with the top-level help reference', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['help', '--command-name'], { stdout, stderr });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Error: Missing value for option "--command-name"\./);
  assert.match(stderr.output, /Usage: orfe help \[--command-name <command>]$/m);
  assert.match(stderr.output, /See: orfe help --help/);
});

test('runCli does not support -v as a root-level alias for --version', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['-v'], { stdout, stderr });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Unknown command group "-v"\./);
  assert.match(stderr.output, /See: orfe --help/);
});

describe('runCli renders help for each command group', () => {
  for (const group of COMMAND_GROUPS) {
    test(`group ${group}`, async () => {
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
    });
  }
});

describe('runCli renders leaf help for every agreed V1 command', () => {
  for (const commandName of ALL_COMMANDS) {
    test(commandName, async () => {
      const stdout = new MemoryStream();
      const stderr = new MemoryStream();
      const definition = getCommandDefinition(commandName);
      const args = definition.topLevel ? [commandName, '--help'] : [definition.group, definition.leaf, '--help'];

      const exitCode = await runCli(args, { stdout, stderr });

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
    });
  }
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
  assert.match(stderr.output, /CLI caller identity is required via ORFE_CALLER_NAME\./);
  assert.match(stderr.output, /See: orfe issue get --help/);
});

test('runCli requires caller identity and mints auth token for that caller bot', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockAuthTokenMintRequest({});

    const exitCode = await runCli(['auth', 'token', '--repo', 'throw-if-null/orfe'], {
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

test('runCli rejects bot override for auth token as invalid usage', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['auth', 'token', '--repo', 'throw-if-null/orfe', '--bot', 'greg'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Unknown option "--bot"\./);
  assert.match(stderr.output, /See: orfe auth token --help/);
});

test('runCli prints structured auth failure for auth token missing installation', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockAuthTokenMintRequest({ installationStatus: 404 });

    const exitCode = await runCli(['auth', 'token', '--repo', 'throw-if-null/orfe'], {
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
      command: 'auth token',
      error: {
        code: 'auth_failed',
        message: 'No GitHub App installation for throw-if-null/orfe was found for app GR3G-BOT.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured config failures for auth token', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['auth', 'token', '--repo', 'throw-if-null/orfe'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => ({
      configPath: repoConfigPath,
      version: 1 as const,
      repository: { owner: 'throw-if-null', name: 'orfe', defaultBranch: 'main' },
      callerToBot: { Greg: 'greg' },
    }),
    loadAuthConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'machine-local auth config not found at /tmp/auth.json.');
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.deepEqual(JSON.parse(stderr.output), {
    ok: false,
    command: 'auth token',
    error: {
      code: 'config_not_found',
      message: 'machine-local auth config not found at /tmp/auth.json.',
      retryable: false,
    },
  });
});

test('runCli reports missing required options for auth token as usage errors', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['auth', 'token'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Missing required option "--repo"\./);
  assert.match(stderr.output, /Usage: orfe auth token --repo <owner\/name>/);
  assert.match(stderr.output, /See: orfe auth token --help/);
});

test('runCli reports missing caller identity for auth token', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['auth', 'token', '--repo', 'throw-if-null/orfe'], {
    stdout,
    stderr,
    env: {},
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /CLI caller identity is required via ORFE_CALLER_NAME\./);
  assert.match(stderr.output, /See: orfe auth token --help/);
});

test('runCli uses ORFE_CALLER_NAME for CLI caller identity', () => {
  const invocation = parseInvocationForCli(['issue', 'get', '--issue-number', '14'], { ORFE_CALLER_NAME: 'Greg' });

  assert.equal(invocation.kind, 'leaf');
  if (invocation.kind === 'leaf') {
    assert.equal(invocation.callerName, 'Greg');
  }
});

test('runCli rejects removed --caller-name option as unknown usage', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'get', '--issue-number', '14', '--caller-name', 'Jelena'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Unknown option "--caller-name"\./);
  assert.match(stderr.output, /See: orfe issue get --help/);
});

test('runCli rejects removed --caller-name override for auth token', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['auth', 'token', '--repo', 'throw-if-null/orfe', '--caller-name', 'Jelena'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Unknown option "--caller-name"\./);
  assert.match(stderr.output, /See: orfe auth token --help/);
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

test('runCli prints structured not-found failures for issue get', async () => {
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
      command: 'issue get',
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

test('runCli prints structured success JSON for issue create', async () => {
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

    if (exitCode !== 0) {
      assert.fail(`Unexpected stderr output: ${stderr.output}`);
    }

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.deepEqual(JSON.parse(stdout.output), {
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

test('runCli prints structured success JSON for issue create with explicit project assignment', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const issueApi = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
      },
    });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      projectItemId: 'PVTI_lAHOABCD1234',
      includeAuth: false,
    });

    const exitCode = await runCli(['issue', 'create', '--title', 'New issue title', '--add-to-project'], {
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
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured success JSON for issue create with a user-owned project assignment', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const issueApi = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
      },
    });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'octocat',
      projectNumber: 7,
      projectId: 'PVT_project_user_7',
      graphqlResponseBody: createProjectLookupResponse({ projectId: 'PVT_project_user_7', ownerType: 'user' }),
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_user_7',
      contentId: 'I_kwDOOrfeIssue21',
      projectItemId: 'PVTI_lAHOABCDUSER',
      includeAuth: false,
    });

    const exitCode = await runCli(
      ['issue', 'create', '--title', 'New issue title', '--add-to-project', '--project-owner', 'octocat', '--project-number', '7'],
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
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
        project_assignment: {
          project_owner: 'octocat',
          project_number: 7,
          project_item_id: 'PVTI_lAHOABCDUSER',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured partial-failure details when issue create project add fails', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const issueApi = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
      },
    });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
      includeAuth: false,
    });

    const exitCode = await runCli(['issue', 'create', '--title', 'New issue title', '--add-to-project'], {
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
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli reports project_add failure details when status was requested but project add fails', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const issueApi = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
      },
    });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
      includeAuth: false,
    });

    const exitCode = await runCli(['issue', 'create', '--title', 'New issue title', '--status', 'Todo'], {
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
          status_field_name: 'Status',
          requested_status: 'Todo',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli validates issue bodies against explicit contracts and appends provenance', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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
      requestBody: {
        title: 'New issue title',
        body: `${issueBody}\n\n${renderIssueBodyContractMarker()}`,
      },
    });

    const exitCode = await runCli(
      ['issue', 'create', '--title', 'New issue title', '--body', issueBody, '--body-contract', 'formal-work-item@1.0.0'],
      {
        stdout,
        stderr,
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    if (exitCode !== 0) {
      assert.fail(`Unexpected stderr output: ${stderr.output}`);
    }

    assert.equal(exitCode, 0);
    assert.equal(stderr.output, '');
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured success JSON for issue validate', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const exitCode = await runCli(
      [
        'issue',
        'validate',
        '--body',
        '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned contract.\n\n## Scope\n\n### In scope\n- declarative contracts\n\n### Out of scope\n- executable plugins\n\n## Acceptance criteria\n\n- [ ] contracts load from .orfe/contracts\n\n## Docs impact\n\n- Docs impact: update existing docs\n- Details: update docs/orfe/spec.md\n\n## ADR needed?\n\n- ADR needed: no\n- Details: covered by ADR 0009\n\n## Dependencies / sequencing notes\n\n- depends on #59\n\n## Risks / open questions / non-goals\n\n- keep repo-specific structure out of runtime logic',
        '--body-contract',
        'formal-work-item@1.0.0',
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
        normalized_body:
          '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned contract.\n\n## Scope\n\n### In scope\n- declarative contracts\n\n### Out of scope\n- executable plugins\n\n## Acceptance criteria\n\n- [ ] contracts load from .orfe/contracts\n\n## Docs impact\n\n- Docs impact: update existing docs\n- Details: update docs/orfe/spec.md\n\n## ADR needed?\n\n- ADR needed: no\n- Details: covered by ADR 0009\n\n## Dependencies / sequencing notes\n\n- depends on #59\n\n## Risks / open questions / non-goals\n\n- keep repo-specific structure out of runtime logic\n\n<!-- orfe-body-contract: issue/formal-work-item@1.0.0 -->',
        errors: [],
      },
    });
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured issue validation failures for issue validate', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const exitCode = await runCli(
      [
        'issue',
        'validate',
        '--body',
        '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned contract.\n\n## Scope\n\n### In scope\n- declarative contracts\n\n## Docs impact\n\n- Docs impact: maybe\n\n## ADR needed?\n\n- ADR needed: no',
        '--body-contract',
        'formal-work-item@1.0.0',
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
    assert.equal(JSON.parse(stdout.output).data.valid, false);
    assert.deepEqual(
      JSON.parse(stdout.output).data.errors.map((issue: { kind: string }) => issue.kind),
      ['missing_required_pattern', 'missing_required_section', 'invalid_allowed_value'],
    );
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured success JSON for pr get', async () => {
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

test('runCli prints structured not-found failures for pr get', async () => {
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
      command: 'pr get',
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

test('runCli prints structured auth failures for pr get', async () => {
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
      command: 'pr get',
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

test('runCli reports missing required options for pr get as usage errors', async () => {
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

test('runCli prints structured config failures for pr get', async () => {
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
    command: 'pr get',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli prints structured success JSON for pr get-or-create when reusing a pull request', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

    const exitCode = await runCli(['pr', 'get-or-create', '--head', 'issues/orfe-13', '--title', 'Design the `orfe` custom tool and CLI contract'], {
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

test('runCli prints structured success JSON for pr get-or-create when creating a pull request', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

    const exitCode = await runCli(
      ['pr', 'get-or-create', '--head', 'issues/orfe-13', '--title', 'Design the `orfe` custom tool and CLI contract', '--body', 'Ref: #13', '--draft'],
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

test('runCli prints structured success JSON for pr update', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {
        title: 'Updated PR title',
        body: 'Updated PR body',
      },
    });

    const exitCode = await runCli(['pr', 'update', '--pr-number', '9', '--title', 'Updated PR title', '--body', 'Updated PR body'], {
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
      command: 'pr update',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        title: 'Updated PR title',
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        head: 'issues/orfe-13',
        base: 'main',
        draft: false,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured contract-validation failures for invalid pr update bodies', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {},
    });

    const exitCode = await runCli(
      ['pr', 'update', '--pr-number', '9', '--body', 'Ref: #142\n\nCloses: #142', '--body-contract', 'implementation-ready@1.0.0'],
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
      command: 'pr update',
      error: {
        code: 'contract_validation_failed',
        message: 'Body contract validation failed: body matched forbidden pattern (?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured not-found failures for pr update', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestUpdateRequest({
      prNumber: 404,
      requestBody: { title: 'Updated PR title' },
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    const exitCode = await runCli(['pr', 'update', '--pr-number', '404', '--title', 'Updated PR title'], {
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
      command: 'pr update',
      error: {
        code: 'github_not_found',
        message: 'Pull request #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli reports invalid option combinations for pr update as usage errors', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['pr', 'update', '--pr-number', '9', '--body-contract', 'implementation-ready@1.0.0'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /pr update only allows body_contract together with --body\./);
  assert.match(stderr.output, /Usage: orfe pr update --pr-number <number> \[--title <text>] \[--body <text>] \[--body-contract <name@version>] \[--repo <owner\/name>] \[--config <path>] \[--auth-config <path>]$/m);
  assert.match(stderr.output, /See: orfe pr update --help/);
});

test('runCli reports missing mutation options for pr update as usage errors', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['pr', 'update', '--pr-number', '9'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /pr update requires at least one mutation option\./);
  assert.match(stderr.output, /Usage: orfe pr update --pr-number <number> \[--title <text>] \[--body <text>] \[--body-contract <name@version>] \[--repo <owner\/name>] \[--config <path>] \[--auth-config <path>]$/m);
  assert.match(stderr.output, /See: orfe pr update --help/);
});

test('runCli prints structured success JSON for pr validate', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const exitCode = await runCli(
      [
        'pr',
        'validate',
        '--body',
        'Ref: #58\n\n## Summary\n- add PR body validation\n\n## Verification\n- `npm test` ✅\n- `npm run lint` ✅\n- `npm run typecheck` ✅\n- `npm run build` ✅\n\n## Docs / ADR / debt\n- docs updated: yes\n- ADR updated: no\n- debt updated: no\n- details: updated docs/orfe/spec.md\n\n## Risks / follow-ups\n- none',
        '--body-contract',
        'implementation-ready@1.0.0',
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
      command: 'pr validate',
      repo: 'throw-if-null/orfe',
      data: {
        valid: true,
        contract: {
          artifact_type: 'pr',
          contract_name: 'implementation-ready',
          contract_version: '1.0.0',
        },
        contract_source: 'explicit',
        normalized_body:
          'Ref: #58\n\n## Summary\n- add PR body validation\n\n## Verification\n- `npm test` ✅\n- `npm run lint` ✅\n- `npm run typecheck` ✅\n- `npm run build` ✅\n\n## Docs / ADR / debt\n- docs updated: yes\n- ADR updated: no\n- debt updated: no\n- details: updated docs/orfe/spec.md\n\n## Risks / follow-ups\n- none\n\n<!-- orfe-body-contract: pr/implementation-ready@1.0.0 -->',
        errors: [],
      },
    });
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured PR validation failures for pr validate', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const exitCode = await runCli(
      ['pr', 'validate', '--body', 'Ref: #58\n\nCloses: #58', '--body-contract', 'implementation-ready@1.0.0'],
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
    assert.equal(JSON.parse(stdout.output).data.valid, false);
    assert.deepEqual(
      JSON.parse(stdout.output).data.errors.map((issue: { kind: string }) => issue.kind),
      ['matched_forbidden_pattern', 'missing_required_section', 'missing_required_section', 'missing_required_section', 'missing_required_section'],
    );
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli validates PR bodies against explicit contracts and appends provenance', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

    const exitCode = await runCli(
      [
        'pr',
        'get-or-create',
        '--head',
        'issues/orfe-59',
        '--title',
        'Introduce versioned body-contract support',
        '--body',
        prBody,
        '--body-contract',
        'implementation-ready@1.0.0',
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
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured contract-validation failures for invalid PR bodies', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-59',
      existingPullRequests: [],
    });

    const exitCode = await runCli(
      [
        'pr',
        'get-or-create',
        '--head',
        'issues/orfe-59',
        '--title',
        'Introduce versioned body-contract support',
        '--body',
        'Ref: #59\n\nCloses: #59',
        '--body-contract',
        'implementation-ready@1.0.0',
      ],
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
      command: 'pr get-or-create',
      error: {
        code: 'contract_validation_failed',
        message: 'Body contract validation failed: body matched forbidden pattern (?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured auth failures for pr get-or-create lookup', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      listStatus: 403,
      listResponseBody: { message: 'Resource not accessible by integration' },
    });

    const exitCode = await runCli(['pr', 'get-or-create', '--head', 'issues/orfe-13', '--title', 'Design the `orfe` custom tool and CLI contract'], {
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
      command: 'pr get-or-create',
      error: {
        code: 'auth_failed',
        message: 'GitHub App authentication failed while looking up pull requests for head "issues/orfe-13" and base "main".',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli reports missing required options for pr get-or-create as usage errors', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['pr', 'get-or-create', '--head', 'issues/orfe-13'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Missing required option "--title"\./);
  assert.match(stderr.output, /Usage: orfe pr get-or-create --head <branch> --title <text>/);
  assert.match(stderr.output, /See: orfe pr get-or-create --help/);
});

test('runCli prints structured config failures for pr get-or-create', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['pr', 'get-or-create', '--head', 'issues/orfe-13', '--title', 'Design the `orfe` custom tool and CLI contract'], {
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
    command: 'pr get-or-create',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli prints structured success JSON for pr comment', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestCommentRequest({ prNumber: 9, body: 'Hello from orfe' });

    const exitCode = await runCli(['pr', 'comment', '--pr-number', '9', '--body', 'Hello from orfe'], {
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

test('runCli prints structured not-found failures for pr comment', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestCommentRequest({
      prNumber: 404,
      body: 'Hello from orfe',
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    const exitCode = await runCli(['pr', 'comment', '--pr-number', '404', '--body', 'Hello from orfe'], {
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
      command: 'pr comment',
      error: {
        code: 'github_not_found',
        message: 'Pull request #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured success JSON for pr submit-review', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestSubmitReviewRequest({ prNumber: 9, body: 'Looks good', event: 'APPROVE' });

    const exitCode = await runCli(['pr', 'submit-review', '--pr-number', '9', '--event', 'approve', '--body', 'Looks good'], {
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

test('runCli prints structured not-found failures for pr submit-review', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestSubmitReviewRequest({
      prNumber: 404,
      body: 'Looks good',
      event: 'APPROVE',
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    const exitCode = await runCli(
      ['pr', 'submit-review', '--pr-number', '404', '--event', 'approve', '--body', 'Looks good'],
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
      command: 'pr submit-review',
      error: {
        code: 'github_not_found',
        message: 'Pull request #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured auth failures for pr submit-review', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestSubmitReviewRequest({
      prNumber: 9,
      body: 'Looks good',
      event: 'APPROVE',
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    const exitCode = await runCli(['pr', 'submit-review', '--pr-number', '9', '--event', 'approve', '--body', 'Looks good'], {
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
      command: 'pr submit-review',
      error: {
        code: 'auth_failed',
        message: 'GitHub App authentication failed while submitting a review on pull request #9.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured config failures for pr submit-review', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['pr', 'submit-review', '--pr-number', '9', '--event', 'approve', '--body', 'Looks good'], {
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
    command: 'pr submit-review',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli formats core invalid_input errors as structured failures for pr submit-review', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['pr', 'submit-review', '--pr-number', '9', '--event', 'dismiss', '--body', 'Looks good'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.deepEqual(JSON.parse(stderr.output), {
    ok: false,
    command: 'pr submit-review',
    error: {
      code: 'invalid_input',
      message: 'Review event must be one of: approve, request-changes, comment.',
      retryable: false,
    },
  });
});

test('runCli prints structured success JSON for pr reply', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestReplyRequest({ prNumber: 9, commentId: 123456, body: 'ack' });

    const exitCode = await runCli(['pr', 'reply', '--pr-number', '9', '--comment-id', '123456', '--body', 'ack'], {
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

test('runCli prints structured not-found failures for pr reply', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockPullRequestReplyRequest({
      prNumber: 9,
      commentId: 123456,
      body: 'ack',
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    const exitCode = await runCli(['pr', 'reply', '--pr-number', '9', '--comment-id', '123456', '--body', 'ack'], {
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
      command: 'pr reply',
      error: {
        code: 'github_not_found',
        message: 'Review comment #123456 was not found on pull request #9.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli reports missing required options for pr reply as usage errors', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['pr', 'reply', '--pr-number', '9', '--body', 'ack'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Missing required option "--comment-id"\./);
  assert.match(stderr.output, /Usage: orfe pr reply --pr-number <number> --comment-id <number> --body <text>/);
  assert.match(stderr.output, /See: orfe pr reply --help/);
});

test('runCli prints structured config failures for pr reply', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['pr', 'reply', '--pr-number', '9', '--comment-id', '123456', '--body', 'ack'], {
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
    command: 'pr reply',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli prints structured success JSON for project get-status', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

test('runCli prints structured success JSON for project get-status when the target is a pull request', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

    const exitCode = await runCli(['project', 'get-status', '--item-type', 'pr', '--item-number', '9'], {
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

test('runCli prints structured project-item-not-found failures for project get-status', async () => {
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
              projectItems: createProjectItemsConnection([]),
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
      command: 'project get-status',
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

test('runCli prints structured missing-status-field failures for project get-status', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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
      command: 'project get-status',
      error: {
        code: 'project_status_field_not_found',
        message: 'GitHub Project throw-if-null/1 has no single-select field named "Status".',
        retryable: false,
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured auth failures for project get-status', async () => {
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
      command: 'project get-status',
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

test('runCli prints structured config failures for project get-status', async () => {
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
    command: 'project get-status',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli prints structured success JSON for project set-status', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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
                ],
              },
            ]),
          },
        },
      },
    });

    const exitCode = await runCli(['project', 'set-status', '--item-type', 'issue', '--item-number', '13', '--status', 'In Progress'], {
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

test('runCli prints structured missing-project-item failures for project set-status', async () => {
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
              projectItems: createProjectItemsConnection([]),
            },
          },
        },
      },
    });

    const exitCode = await runCli(['project', 'set-status', '--item-type', 'issue', '--item-number', '13', '--status', 'In Progress'], {
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
      command: 'project set-status',
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

test('runCli prints structured invalid-status failures for project set-status', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

    const exitCode = await runCli(['project', 'set-status', '--item-type', 'issue', '--item-number', '13', '--status', 'Blocked'], {
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
      command: 'project set-status',
      error: {
        code: 'project_status_option_not_found',
        message: 'GitHub Project throw-if-null/1 field "Status" has no option named "Blocked".',
        retryable: false,
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured auth failures for project set-status', async () => {
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

    const exitCode = await runCli(['project', 'set-status', '--item-type', 'issue', '--item-number', '13', '--status', 'In Progress'], {
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
      command: 'project set-status',
      error: {
        code: 'auth_failed',
        message: 'GitHub App authentication failed while setting project status for issue #13.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured config failures for project set-status', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['project', 'set-status', '--item-type', 'issue', '--item-number', '13', '--status', 'In Progress'], {
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
    command: 'project set-status',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli prints structured auth failures for issue create', async () => {
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
      command: 'issue create',
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

test('runCli prints structured repository-not-found failures for issue create', async () => {
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
      command: 'issue create',
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

test('runCli prints structured creation failures for issue create', async () => {
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
      command: 'issue create',
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

test('runCli prints structured success JSON for issue update', async () => {
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

test('runCli prints structured not-found failures for issue update', async () => {
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
      command: 'issue update',
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

test('runCli prints structured pull-request boundary failures for issue update', async () => {
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
      command: 'issue update',
      error: {
        code: 'github_conflict',
        message: 'Issue #46 is a pull request. issue update only supports issues.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured success JSON for issue comment', async () => {
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

test('runCli formats core invalid_usage errors as CLI usage failures for issue update', async () => {
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
  assert.match(stderr.output, /issue update requires at least one mutation option\./);
  assert.match(stderr.output, /Usage: orfe issue update --issue-number <number>/);
  assert.match(stderr.output, /See: orfe issue update --help/);
});

test('runCli rejects conflicting issue update clear and replacement options', async () => {
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

test('runCli prints structured config failures for issue update', async () => {
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
    command: 'issue update',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli prints structured not-found failures for issue comment', async () => {
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
      command: 'issue comment',
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

test('runCli prints structured pull-request boundary failures for issue comment', async () => {
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
      command: 'issue comment',
      error: {
        code: 'github_conflict',
        message: 'Issue #46 is a pull request. Use pr comment instead.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured success JSON for issue set-state', async () => {
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

test('runCli prints structured success JSON for duplicate issue set-state', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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

test('runCli prints structured not-found failures for issue set-state duplicate targets', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  nock.disableNetConnect();

  try {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 999,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
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
      command: 'issue set-state',
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

test('runCli prints structured pull-request boundary failures for duplicate issue set-state targets', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

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
      command: 'issue set-state',
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

test('runCli prints structured pull-request boundary failures for issue set-state', async () => {
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
      command: 'issue set-state',
      error: {
        code: 'github_conflict',
        message: 'Issue #46 is a pull request. issue set-state only supports issues.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test('runCli prints structured config failures for issue set-state', async () => {
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
    command: 'issue set-state',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli formats core invalid_usage errors as CLI usage failures for issue comment', async () => {
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
  assert.match(stderr.output, /Example: ORFE_CALLER_NAME=Greg orfe issue comment --issue-number 14 --body "hello"/);
  assert.match(stderr.output, /See: orfe issue comment --help/);
});

test('runCli prints structured config failures for issue comment', async () => {
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
    command: 'issue comment',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});

test('runCli prints structured config failures for issue get', async () => {
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
    command: 'issue get',
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
  assert.match(stderr.output, /Example: ORFE_CALLER_NAME=Greg orfe issue set-state --issue-number 14 --state closed --state-reason completed/);
  assert.match(stderr.output, /See: orfe issue set-state --help/);
});

test('runCli reports malformed numeric CLI option values as usage errors', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'get', '--issue-number', 'nope'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /^Error: Option "--issue-number" expects an integer\./);
  assert.match(stderr.output, /Usage: orfe issue get --issue-number <number>/);
  assert.match(stderr.output, /Example: ORFE_CALLER_NAME=Greg orfe issue get --issue-number 14/);
  assert.match(stderr.output, /See: orfe issue get --help/);
});

test('runCli reports malformed pr submit-review event values as structured invalid_input failures', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(
    ['pr', 'submit-review', '--pr-number', '9', '--event', 'nope', '--body', 'ok'],
    {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
    },
  );

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.deepEqual(JSON.parse(stderr.output), {
    ok: false,
    command: 'pr submit-review',
    error: {
      code: 'invalid_input',
      message: 'Review event must be one of: approve, request-changes, comment.',
      retryable: false,
    },
  });
});

test('runCli reports malformed repo overrides as usage errors', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'get', '--issue-number', '14', '--repo', 'bad'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    ...createRuntimeDependencies(),
  });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Repository must be in "owner\/name" format\./);
  assert.match(stderr.output, /See: orfe issue get --help/);
});

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
