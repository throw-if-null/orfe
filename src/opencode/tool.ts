import { getCommandDefinition } from '../commands/registry/index.js';
import { runOrfeCore } from '../core/run.js';
import { createPluginLogger } from '../logging/logger.js';
import { OrfeError } from '../runtime/errors.js';
import { createErrorResponse } from '../runtime/response.js';

import { resolveCallerNameFromContext } from './context.js';
import type { OpenCodeToolContext, OrfeToolDependencies, OrfeToolResult } from './types.js';

export async function executeOrfeTool(
  input: Record<string, unknown>,
  context: OpenCodeToolContext,
  dependencies: OrfeToolDependencies = {},
): Promise<OrfeToolResult> {
  const command = typeof input.command === 'string' ? input.command : 'unknown';
  const runOrfeCoreImpl = dependencies.runOrfeCoreImpl ?? runOrfeCore;

  try {
    if ('caller_name' in input) {
      throw new OrfeError('invalid_usage', 'Tool input does not accept caller_name; caller identity comes from context.agent.');
    }

    if (typeof input.command !== 'string' || input.command.trim().length === 0) {
      throw new OrfeError('invalid_usage', 'Tool input requires a non-empty command string.');
    }

    const commandDefinition = getCommandDefinition(input.command);
    const callerName = (commandDefinition.requiresCaller ?? true) ? resolveCallerNameFromContext(context) : '';
    const rest = { ...input };
    delete rest.command;
    const configPath = readToolPathInput(rest, 'config');
    const authConfigPath = readToolPathInput(rest, 'auth_config');
    delete rest.config;
    delete rest.auth_config;

    return await runOrfeCoreImpl(
      {
        callerName,
        command: input.command,
        input: rest,
        entrypoint: 'opencode-plugin',
        ...(configPath ? { configPath } : {}),
        ...(authConfigPath ? { authConfigPath } : {}),
        ...(context.cwd ? { cwd: context.cwd } : {}),
        logger: createPluginLogger({
          ...(context.env ? { env: context.env } : {}),
          ...(context.stderr ? { stderr: context.stderr } : {}),
        }),
      },
      dependencies,
    );
  } catch (error) {
    return createErrorResponse(command, error);
  }
}

function readToolPathInput(input: Record<string, unknown>, key: 'config' | 'auth_config'): string | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OrfeError('invalid_usage', `Option "${key}" must be a non-empty string.`);
  }

  return value;
}

export type { OpenCodeToolContext, OrfeToolDependencies, OrfeToolResult } from './types.js';
export { resolveCallerNameFromContext } from './context.js';
