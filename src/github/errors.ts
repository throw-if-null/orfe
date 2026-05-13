import { OrfeError } from '../runtime/errors.js';

export function mapGitHubRequestError(
  error: unknown,
  options: { notFoundMessage?: string; fallbackMessage?: string } = {},
): OrfeError {
  if (isRequestError(error)) {
    if (error.status === 404 && options.notFoundMessage) {
      return new OrfeError('auth_failed', options.notFoundMessage);
    }

    return new OrfeError(
      'auth_failed',
      options.fallbackMessage ?? `GitHub API request failed with status ${error.status}: ${error.message}`,
    );
  }

  if (error instanceof OrfeError) {
    return error;
  }

  if (error instanceof Error) {
    return new OrfeError('auth_failed', error.message);
  }

  return new OrfeError('auth_failed', 'Unknown GitHub authentication failure.');
}

export function mapPrivateKeyReadError(error: unknown, filePath: string): OrfeError {
  if (isNodeError(error) && error.code === 'ENOENT') {
    return new OrfeError('auth_failed', `Private key file not found at ${filePath}.`);
  }

  return new OrfeError('auth_failed', `Unable to read private key file at ${filePath}.`);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isRequestError(error: unknown): error is Error & { status: number } {
  return error instanceof Error && 'status' in error && typeof (error as { status?: unknown }).status === 'number';
}
