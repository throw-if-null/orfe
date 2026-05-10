import assert from 'node:assert/strict';

import { test } from 'vitest';

test('runCliEntrypoint forwards process argv tail to runCli and sets process.exitCode', async () => {
  const observedCalls: string[][] = [];
  const processStub: { exitCode: number | undefined } = { exitCode: undefined };
  const originalArgv = process.argv;

  process.argv = ['/usr/bin/node', '/tmp/orfe', 'issue', 'get', '--issue-number', '14'];

  try {
    const { runCliEntrypoint } = await import('./cli.js');

    const exitCode = await runCliEntrypoint({
      runCliImpl: async (args) => {
        observedCalls.push(args);
        return 23;
      },
      processImpl: processStub,
    });

    assert.equal(exitCode, 23);
    assert.deepEqual(observedCalls, [['issue', 'get', '--issue-number', '14']]);
    assert.equal(processStub.exitCode, 23);
  } finally {
    process.argv = originalArgv;
  }
});

test('runCliEntrypoint prefers explicit argv over process.argv', async () => {
  const processStub: { exitCode: number | undefined } = { exitCode: undefined };
  const { runCliEntrypoint } = await import('./cli.js');

  const exitCode = await runCliEntrypoint({
    argv: ['help'],
    runCliImpl: async (args) => {
      assert.deepEqual(args, ['help']);
      return 0;
    },
    processImpl: processStub,
  });

  assert.equal(exitCode, 0);
  assert.equal(processStub.exitCode, 0);
});
