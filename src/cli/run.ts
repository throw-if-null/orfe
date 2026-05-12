import { runOrfeCore } from '../core/run.js';
import { createCliLogger } from '../logging/logger.js';
import { CliUsageError, OrfeError, formatCliUsageError } from '../runtime/errors.js';
import { createErrorResponse } from '../runtime/response.js';

import { createLeafUsageError, parseInvocationForCli } from './parse.js';
import type { ParsedLeafInvocation, RunCliDependencies } from './types.js';

export async function runCli(args: string[], dependencies: RunCliDependencies = {}): Promise<number> {
  const env = dependencies.env ?? process.env;
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const logger = createCliLogger({ env, stderr });
  let parsedInvocation: ParsedLeafInvocation | undefined;

  try {
    const invocation = parseInvocationForCli(args, env);
    if (invocation.kind === 'help' || invocation.kind === 'version') {
      stdout.write(`${invocation.output}\n`);
      return 0;
    }

    parsedInvocation = invocation;
    const result = await runOrfeCore(
      {
        callerName: invocation.callerName,
        command: invocation.commandDefinition.name,
        input: invocation.input,
        entrypoint: 'cli',
        ...(invocation.configPath ? { configPath: invocation.configPath } : {}),
        ...(invocation.authConfigPath ? { authConfigPath: invocation.authConfigPath } : {}),
        logger,
      },
      dependencies,
    );

    stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError) {
      stderr.write(`${formatCliUsageError(error)}\n`);
      return 2;
    }

    if (parsedInvocation && error instanceof OrfeError && error.code === 'invalid_usage') {
      const cliUsageError = createLeafUsageError(parsedInvocation.commandDefinition, error.message);
      stderr.write(`${formatCliUsageError(cliUsageError)}\n`);
      return 2;
    }

    const commandName = parsedInvocation?.commandDefinition.name ?? 'unknown';
    stderr.write(`${JSON.stringify(createErrorResponse(commandName, error))}\n`);
    return 1;
  }
}
