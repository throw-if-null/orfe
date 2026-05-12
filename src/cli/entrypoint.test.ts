import assert from 'node:assert/strict';

import { test } from 'vitest';
import { runCliEntrypoint } from './entrypoint.js';

import type { runCli } from './run.js';

test('runCliEntrypoint forwards explicit argv to runCli and sets process.exitCode', async () => {
  const observedCalls: string[][] = [];
  const processStub: { exitCode: number | undefined } = { exitCode: undefined };
  const runCliImpl: typeof runCli = async (args) => {
    observedCalls.push(args);
    return 23;
  };

  const exitCode = await runCliEntrypoint({
    argv: ['issue', 'get', '--issue-number', '14'],
    runCliImpl,
    processImpl: processStub,
  });

  assert.equal(exitCode, 23);
  assert.deepEqual(observedCalls, [['issue', 'get', '--issue-number', '14']]);
  assert.equal(processStub.exitCode, 23);
});

test('runCliEntrypoint falls back to process argv tail when argv is omitted', async () => {
  const processStub: { exitCode: number | undefined } = { exitCode: undefined };
  const originalArgv = process.argv;
  const runCliImpl: typeof runCli = async (args) => {
    assert.deepEqual(args, ['issue', 'get', '--issue-number', '14']);
    return 0;
  };

  process.argv = ['/usr/bin/node', '/tmp/orfe', 'issue', 'get', '--issue-number', '14'];

  try {
    const exitCode = await runCliEntrypoint({
      runCliImpl,
      processImpl: processStub,
    });

    assert.equal(exitCode, 0);
    assert.equal(processStub.exitCode, 0);
  } finally {
    process.argv = originalArgv;
  }
});
