import assert from 'node:assert/strict';

import { describe, test } from 'vitest';

import { getCommandDefinition, getGroupDefinitions, listCommandGroups, listCommandNames } from '../../src/commands/registry/index.js';
import { parseInvocationForCli } from '../../src/cli/parse.js';
import { runCli } from '../../src/cli/run.js';
import { MemoryStream, createRuntimeDependencies, readPackageVersion } from '../support/cli-test.js';

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
});

test('runCli prints runtime info without caller, config, auth, or GitHub access', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();
  const packageVersion = await readPackageVersion();

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
