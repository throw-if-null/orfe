import type { OrfeCoreDependencies, OrfeCoreRequest } from '../core/types.js';
import type { ErrorResponse, SuccessResponse } from '../runtime/response.js';

export interface OpenCodeToolContext {
  agent?: unknown;
  cwd?: string;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
  env?: NodeJS.ProcessEnv;
}

type RunOrfeCore = (request: OrfeCoreRequest, dependencies?: OrfeCoreDependencies) => Promise<SuccessResponse<unknown>>;

export interface OrfeToolDependencies extends OrfeCoreDependencies {
  runOrfeCoreImpl?: RunOrfeCore;
}

export type OrfeToolResult = SuccessResponse<unknown> | ErrorResponse;
