export class TokennerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokennerError';
  }
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}
