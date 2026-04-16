import type { CommandOptionDefinition } from './types.js';

export function createRepoOption(required = false): CommandOptionDefinition {
  return {
    key: 'repo',
    flag: '--repo',
    description: 'Override the target repository as owner/name.',
    type: 'string',
    ...(required ? { required: true } : {}),
  };
}

export const COMMON_CLI_OPTIONS: readonly CommandOptionDefinition[] = [
  {
    key: 'config',
    flag: '--config',
    description: 'Override the repo-local config path.',
    type: 'string',
  },
  {
    key: 'auth_config',
    flag: '--auth-config',
    description: 'Override the machine-local auth config path.',
    type: 'string',
  },
] as const;
