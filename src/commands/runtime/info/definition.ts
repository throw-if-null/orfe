import { createCommandDefinition } from '../../registry/definition.js';
import { getRuntimeInfo } from '../../../version.js';

export const runtimeInfoCommand = createCommandDefinition({
  name: 'runtime info',
  execution: 'runtime',
  purpose: 'Inspect the active orfe runtime version and entrypoint.',
  usage: 'orfe runtime info',
  successSummary: 'Prints structured JSON with the active orfe runtime version and entrypoint.',
  examples: ['orfe runtime info'],
  options: [],
  validInputExample: {},
  successDataExample: {
    orfe_version: '0.4.0',
    entrypoint: 'opencode-plugin' as const,
  },
  requiresCaller: false,
  requiresRepoConfig: false,
  requiresAuthConfig: false,
  requiresGitHubAccess: false,
  runtimeHandler: ({ entrypoint }) => getRuntimeInfo(entrypoint),
});
