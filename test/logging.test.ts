import assert from 'node:assert/strict';
import { test } from 'vitest';

import { runCli } from '../src/command.js';
import { GitHubClientFactory, type GitHubOctokitOptions } from '../src/github.js';
import { createLogger } from '../src/logger.js';
import type { GitHubAppBotAuthConfig, RepoRef } from '../src/types.js';
import { executeOrfeTool } from '../src/wrapper.js';

class MemoryStream {
  output = '';

  write(chunk: string): boolean {
    this.output += chunk;
    return true;
  }
}

class EmittingGitHubClientFactory extends GitHubClientFactory {
  constructor(private readonly emitLevel: 'warn' | 'error') {
    super();
  }

  override async createClient(
    botName: string,
    botAuth: GitHubAppBotAuthConfig,
    repo: RepoRef,
    logger = createLogger(),
  ) {
    const issue = {
      number: 113,
      title: 'Introduce internal logger with log levels and entrypoint-specific sinks',
      body: 'Issue body',
      state: 'open',
      state_reason: null,
      labels: [],
      assignees: [],
      html_url: 'https://github.com/throw-if-null/orfe/issues/113',
    };

    return {
      octokit: {} as never,
      rest: {
        issues: {
          get: async () => ({ data: issue }),
          update: async () => {
            logger[this.emitLevel]('Octokit deprecation warning', {
              source: 'octokit',
              command: 'issue update',
            });

            return { data: issue };
          },
        },
      } as never,
      graphql: (async () => ({})) as never,
      auth: {
        botName,
        appSlug: botAuth.appSlug,
        installationId: 42,
        token: 'ghs_123',
        expiresAt: '2026-04-06T12:00:00Z',
      },
    };
  }

  override async createInstallationAuth(botName: string, botAuth: GitHubAppBotAuthConfig) {
    return {
      installationId: 42,
      token: `token-for-${botName}`,
      expiresAt: botAuth.appSlug,
    };
  }
}

function createRuntimeDependencies(githubClientFactory: GitHubClientFactory) {
  return {
    loadRepoConfigImpl: async () => ({
      configPath: '/tmp/.orfe/config.json',
      version: 1 as const,
      repository: { owner: 'throw-if-null', name: 'orfe', defaultBranch: 'main' },
      callerToBot: { Greg: 'greg' },
    }),
    loadAuthConfigImpl: async () => ({
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
    }),
    githubClientFactory,
  };
}

test('GitHubClientFactory routes Octokit log callbacks through the orfe logger', async () => {
  const entries: Array<{ level: string; message: string; context?: Record<string, unknown> }> = [];
  const logger = createLogger({
    level: 'warn',
    sink: (entry) => {
      entries.push(entry);
    },
  });
  const capturedOptions: GitHubOctokitOptions[] = [];
  let octokitCallCount = 0;

  const factory = new GitHubClientFactory({
    readFileImpl: async () => 'private-key',
    jwtFactory: () => 'jwt-token',
    octokitFactory: (options = {}) => {
      capturedOptions.push(options);
      octokitCallCount += 1;

      if (octokitCallCount === 1) {
        return {
          request: async (route: string) => {
            if (route === 'GET /repos/{owner}/{repo}/installation') {
              return { data: { id: 42 } };
            }

            if (route === 'POST /app/installations/{installation_id}/access_tokens') {
              return { data: { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' } };
            }

            throw new Error(`Unexpected route: ${route}`);
          },
          hook: { before() {} },
        } as never;
      }

      return {
        rest: {},
        graphql: async () => ({}),
        hook: { before() {} },
      } as never;
    },
  });

  await factory.createClient(
    'greg',
    {
      provider: 'github-app',
      appId: 123,
      appSlug: 'GR3G-BOT',
      privateKeyPath: '/tmp/greg.pem',
    },
    {
      owner: 'throw-if-null',
      name: 'orfe',
      fullName: 'throw-if-null/orfe',
    },
    logger,
  );

  capturedOptions[0]?.log?.warn('Octokit app warning');
  capturedOptions[1]?.log?.warn('Octokit client warning');

  assert.equal(capturedOptions.length, 2);
  assert.deepEqual(entries, [
    { level: 'warn', message: 'Octokit app warning' },
    { level: 'warn', message: 'Octokit client warning' },
  ]);
});

test('CLI suppresses Octokit warnings by default during issue mutation commands', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(
    ['issue', 'update', '--issue-number', '113', '--title', 'Updated title'],
    {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(new EmittingGitHubClientFactory('warn')),
    },
  );

  assert.equal(exitCode, 0);
  assert.equal(stderr.output, '');
  assert.deepEqual(JSON.parse(stdout.output), {
    ok: true,
    command: 'issue update',
    repo: 'throw-if-null/orfe',
    data: {
      issue_number: 113,
      title: 'Introduce internal logger with log levels and entrypoint-specific sinks',
      state: 'open',
      html_url: 'https://github.com/throw-if-null/orfe/issues/113',
      changed: true,
    },
  });
});

test('CLI emits Octokit warnings to stderr when ORFE_LOG_LEVEL=warn', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(
    ['issue', 'update', '--issue-number', '113', '--title', 'Updated title'],
    {
      stdout,
      stderr,
      env: { ORFE_CALLER_NAME: 'Greg', ORFE_LOG_LEVEL: 'warn' },
      ...createRuntimeDependencies(new EmittingGitHubClientFactory('warn')),
    },
  );

  assert.equal(exitCode, 0);
  assert.match(stderr.output, /^\[orfe\]\[warn\] Octokit deprecation warning/m);
  assert.match(stderr.output, /"command":"issue update"/);
  assert.equal(JSON.parse(stdout.output).ok, true);
});

test('OpenCode wrapper suppresses Octokit warnings by default for issue mutation commands', async () => {
  const stderr = new MemoryStream();

  const result = await executeOrfeTool(
    {
      command: 'issue update',
      issue_number: 113,
      title: 'Updated title',
    },
    {
      agent: 'Greg',
      cwd: '/tmp/repo',
      stderr,
      env: {},
    },
    createRuntimeDependencies(new EmittingGitHubClientFactory('warn')),
  );

  assert.equal(stderr.output, '');
  assert.deepEqual(result, {
    ok: true,
    command: 'issue update',
    repo: 'throw-if-null/orfe',
    data: {
      issue_number: 113,
      title: 'Introduce internal logger with log levels and entrypoint-specific sinks',
      state: 'open',
      html_url: 'https://github.com/throw-if-null/orfe/issues/113',
      changed: true,
    },
  });
});

test('OpenCode wrapper emits Octokit warnings when ORFE_LOG_LEVEL=warn', async () => {
  const stderr = new MemoryStream();

  const result = await executeOrfeTool(
    {
      command: 'issue update',
      issue_number: 113,
      title: 'Updated title',
    },
    {
      agent: 'Greg',
      cwd: '/tmp/repo',
      stderr,
      env: { ORFE_LOG_LEVEL: 'warn' },
    },
    createRuntimeDependencies(new EmittingGitHubClientFactory('warn')),
  );

  assert.equal(result.ok, true);
  assert.match(stderr.output, /^\[orfe\]\[warn\] Octokit deprecation warning/m);
  assert.match(stderr.output, /"source":"octokit"/);
});

test('OpenCode wrapper surfaces error logs at the default level', async () => {
  const stderr = new MemoryStream();

  const result = await executeOrfeTool(
    {
      command: 'issue update',
      issue_number: 113,
      title: 'Updated title',
    },
    {
      agent: 'Greg',
      cwd: '/tmp/repo',
      stderr,
      env: {},
    },
    createRuntimeDependencies(new EmittingGitHubClientFactory('error')),
  );

  assert.equal(result.ok, true);
  assert.match(stderr.output, /^\[orfe\]\[error\] Octokit deprecation warning/m);
});
