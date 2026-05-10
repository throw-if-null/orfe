import assert from 'node:assert/strict';

import { test } from 'vitest';
import { runCliEntrypoint } from './cli.js';

test('runCliEntrypoint forwards explicit argv to runCli and sets process.exitCode', async () => {
  const observedCalls: string[][] = [];
  const processStub: { exitCode: number | undefined } = { exitCode: undefined };

  const exitCode = await runCliEntrypoint({
    argv: ['issue', 'get', '--issue-number', '14'],
    runCliImpl: async (args) => {
      observedCalls.push(args);
      return 23;
    },
    processImpl: processStub,
  });

  assert.equal(exitCode, 23);
  assert.deepEqual(observedCalls, [['issue', 'get', '--issue-number', '14']]);
  assert.equal(processStub.exitCode, 23);
});

test('runCliEntrypoint falls back to process argv tail when argv is omitted', async () => {
  const processStub: { exitCode: number | undefined } = { exitCode: undefined };
  const originalArgv = process.argv;

  process.argv = ['/usr/bin/node', '/tmp/orfe', 'issue', 'get', '--issue-number', '14'];

  try {
    const exitCode = await runCliEntrypoint({
      runCliImpl: async (args) => {
        assert.deepEqual(args, ['issue', 'get', '--issue-number', '14']);
        return 0;
      },
      processImpl: processStub,
    });

    assert.equal(exitCode, 0);
    assert.equal(processStub.exitCode, 0);
  } finally {
    process.argv = originalArgv;
  }
});
