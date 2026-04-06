import assert from 'node:assert/strict';
import test from 'node:test';

import { OrfeError } from '../src/errors.js';
import { runCli } from '../src/command.js';

class MemoryStream {
  output = '';

  write(chunk: string): boolean {
    this.output += chunk;
    return true;
  }
}

test('runCli renders root help', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['--help'], { stdout, stderr });

  assert.equal(exitCode, 0);
  assert.equal(stderr.output, '');
  assert.match(stdout.output, /orfe - generic GitHub operations runtime/);
  assert.match(stdout.output, /issue/);
  assert.match(stdout.output, /project/);
});

test('runCli renders group help', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', '--help'], { stdout, stderr });

  assert.equal(exitCode, 0);
  assert.equal(stderr.output, '');
  assert.match(stdout.output, /orfe issue/);
  assert.match(stdout.output, /get - Read one issue/);
  assert.match(stdout.output, /set-state - Set issue open or closed state/);
});

test('runCli renders leaf help', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['pr', 'get-or-create', '--help'], { stdout, stderr });

  assert.equal(exitCode, 0);
  assert.equal(stderr.output, '');
  assert.match(stdout.output, /Purpose: Reuse or create a pull request/);
  assert.match(stdout.output, /Usage: orfe pr get-or-create/);
  assert.match(stdout.output, /Required options:/);
  assert.match(stdout.output, /Examples:/);
});

test('runCli reports invalid usage for unknown commands', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'unknown'], { stdout, stderr });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Error: Unknown command "issue unknown"/);
  assert.match(stderr.output, /See: orfe issue --help/);
});

test('runCli requires caller identity for CLI mode', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'get', '--issue-number', '14'], { stdout, stderr, env: {} });

  assert.equal(exitCode, 2);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /CLI caller identity is required/);
});

test('runCli uses ORFE_CALLER_NAME and prints structured runtime failures', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'get', '--issue-number', '14'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
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
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.deepEqual(JSON.parse(stderr.output), {
    ok: false,
    command: 'issue.get',
    error: {
      code: 'not_implemented',
      message: 'Command "issue.get" is not implemented yet.',
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
