import { OrfeError } from './errors.js';
import { runOrfeCore, type OrfeCoreDependencies } from './core.js';
import { createErrorResponse } from './response.js';
import type { ErrorResponse, SuccessResponse } from './types.js';

export interface OpenCodeToolContext {
  agent?: unknown;
  cwd?: string;
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

    const callerName = resolveCallerNameFromContext(context);
    const rest = { ...input };
    delete rest.command;

    return await runOrfeCoreImpl(
      {
        callerName,
        command: input.command,
        input: rest,
        ...(context.cwd ? { cwd: context.cwd } : {}),
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
