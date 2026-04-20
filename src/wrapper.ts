import { OrfeError } from './errors.js';
import { getCommandDefinition } from './commands/registry/index.js';
import { runOrfeCore, type OrfeCoreDependencies } from './core.js';
import { createPluginLogger } from './logger.js';
import { createErrorResponse } from './response.js';
import type { ErrorResponse, SuccessResponse } from './types.js';

export interface OpenCodeToolContext {
  agent?: unknown;
  cwd?: string;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
  env?: NodeJS.ProcessEnv;
}

export interface OrfeToolDependencies extends OrfeCoreDependencies {
  runOrfeCoreImpl?: typeof runOrfeCore;
}

export type OrfeToolResult = SuccessResponse<unknown> | ErrorResponse;

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
    const configPath = readWrapperPathInput(rest, 'config');
    const authConfigPath = readWrapperPathInput(rest, 'auth_config');
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

export function resolveCallerNameFromContext(context: OpenCodeToolContext): string {
  const { agent } = context;

  if (typeof agent === 'string' && agent.trim().length > 0) {
    return agent.trim();
  }

  if (
    typeof agent === 'object' &&
    agent !== null &&
    'name' in agent &&
    typeof agent.name === 'string' &&
    agent.name.trim().length > 0
  ) {
    return agent.name.trim();
  }

  throw new OrfeError('caller_context_missing', 'OpenCode caller context is missing.');
}

function readWrapperPathInput(input: Record<string, unknown>, key: 'config' | 'auth_config'): string | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OrfeError('invalid_usage', `Option "${key}" must be a non-empty string.`);
  }

  return value;
}
