export const ERROR_CODES = [
  'invalid_usage',
  'invalid_input',
  'caller_context_missing',
  'caller_name_missing',
  'caller_name_unmapped',
  'config_not_found',
  'config_invalid',
  'auth_failed',
  'github_not_found',
  'github_conflict',
  'template_not_found',
  'template_invalid',
  'template_validation_failed',
  'project_item_not_found',
  'project_status_field_not_found',
  'project_status_option_not_found',
  'not_implemented',
  'internal_error',
] as const;

export type OrfeErrorCode = (typeof ERROR_CODES)[number];

export class OrfeError extends Error {
  readonly code: OrfeErrorCode;
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: OrfeErrorCode, message: string, options: { retryable?: boolean; details?: Record<string, unknown> } = {}) {
    super(message);
    this.name = 'OrfeError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
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
