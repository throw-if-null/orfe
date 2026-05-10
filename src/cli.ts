#!/usr/bin/env node

import { fileURLToPath } from 'node:url';

import { runCli } from './command.js';

export async function runCliEntrypoint(options: {
  argv?: string[];
  runCliImpl?: typeof runCli;
  processImpl?: Pick<NodeJS.Process, 'exitCode'>;
} = {}): Promise<number> {
  const runCliImpl = options.runCliImpl ?? runCli;
  const processImpl = options.processImpl ?? process;
  const exitCode = await runCliImpl(options.argv ?? process.argv.slice(2));
  processImpl.exitCode = exitCode;
  return exitCode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runCliEntrypoint();
}
