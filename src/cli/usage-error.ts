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

export function formatCliUsageError(error: CliUsageError): string {
  return [`Error: ${error.message}`, `Usage: ${error.usage}`, `Example: ${error.example}`, `See: ${error.see}`].join('\n');
}
