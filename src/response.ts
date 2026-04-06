import { toOrfeError } from './errors.js';
import type { ErrorResponse, SuccessResponse } from './types.js';

export function createSuccessResponse<TData>(command: string, repo: string, data: TData): SuccessResponse<TData> {
  return {
    ok: true,
    command,
    repo,
    data,
  };
}

export function createErrorResponse(command: string, error: unknown): ErrorResponse {
  const normalizedError = toOrfeError(error);

  return {
    ok: false,
    command,
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
      retryable: normalizedError.retryable,
    },
  };
}
