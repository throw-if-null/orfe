import assert from 'node:assert/strict';
import test from 'node:test';

import { getCommandDefinition, getGroupDefinitions } from '../src/command-registry.js';
import { getCommandContract } from '../src/command-contracts.js';
import { OrfeError } from '../src/errors.js';
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

test('runCli uses ORFE_CALLER_NAME and prints structured runtime failures', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['issue', 'get', '--issue-number', '14'], {
    stdout,
    stderr,
    env: { ORFE_CALLER_NAME: 'Greg' },
    ...createRuntimeDependencies(),
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
