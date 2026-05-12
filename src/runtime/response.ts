import { toOrfeError } from './errors.js';

export interface SuccessResponse<TData> {
  ok: true;
  command: string;
  repo?: string;
  data: TData;
}

export interface ErrorResponse {
  ok: false;
  command: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export function createSuccessResponse<TData>(command: string, repo: string | undefined, data: TData): SuccessResponse<TData> {
  return {
    ok: true,
    command,
    ...(repo ? { repo } : {}),
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
      ...(normalizedError.details ? { details: normalizedError.details } : {}),
    },
  };
}
