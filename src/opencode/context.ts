import { OrfeError } from '../runtime/errors.js';

import type { OpenCodeToolContext } from './types.js';

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
