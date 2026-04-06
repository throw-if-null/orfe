import type { OrfeCommandName } from './types.js';

export const ERROR_CODES = [
  'invalid_usage',
  'caller_context_missing',
  'caller_name_missing',
  'caller_name_unmapped',
  'config_not_found',
  'config_invalid',
  'auth_failed',
  'github_not_found',
  'github_conflict',
  'project_item_not_found',
  'project_status_option_not_found',
  'not_implemented',
  'internal_error',
] as const;

export type OrfeErrorCode = (typeof ERROR_CODES)[number];

export class OrfeError extends Error {
  readonly code: OrfeErrorCode;
  readonly retryable: boolean;

  constructor(code: OrfeErrorCode, message: string, options: { retryable?: boolean } = {}) {
    super(message);
    this.name = 'OrfeError';
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}

export class CliUsageError extends Error {
  readonly usage: string;
  readonly example: string;
  readonly see: string;

  constructor(message: string, details: { usage: string; example: string; see: string }) {
    super(message);
    this.name = 'CliUsageError';
    this.usage = details.usage;
    this.example = details.example;
    this.see = details.see;
  }
}

export function toOrfeError(error: unknown): OrfeError {
  if (error instanceof OrfeError) {
    return error;
  }

  if (error instanceof Error) {
    return new OrfeError('internal_error', error.message);
  }

  return new OrfeError('internal_error', 'Unknown error.');
}

export function formatCliUsageError(error: CliUsageError): string {
  return [`Error: ${error.message}`, `Usage: ${error.usage}`, `Example: ${error.example}`, `See: ${error.see}`].join('\n');
}

export function createNotImplementedError(command: OrfeCommandName): OrfeError {
  return new OrfeError('not_implemented', `Command "${command}" is not implemented yet.`);
}
