import { runOrfeCore, type OrfeCoreDependencies } from '../../src/core.js';
import { executeOrfeTool, type OpenCodeToolContext, type OrfeToolDependencies } from '../../src/wrapper.js';
import type { CommandInput, OrfeCoreRequest } from '../../src/types.js';

import {
  createAuthConfig,
  createGitHubClientFactory,
  createRepoConfig,
  createRepoConfigWithDefaultProject,
} from './runtime-fixtures.js';

export function createCoreDependencies(options: {
  repoConfig?: ReturnType<typeof createRepoConfig>;
  authConfig?: ReturnType<typeof createAuthConfig>;
  overrides?: OrfeCoreDependencies;
} = {}): OrfeCoreDependencies {
  return {
    loadRepoConfigImpl: async () => options.repoConfig ?? createRepoConfig(),
    loadAuthConfigImpl: async () => options.authConfig ?? createAuthConfig(),
    githubClientFactory: createGitHubClientFactory(),
    ...options.overrides,
  };
}

export async function runCoreCommand(options: {
  command: string;
  input: CommandInput;
  request?: Partial<OrfeCoreRequest>;
  dependencies?: OrfeCoreDependencies;
  repoConfig?: ReturnType<typeof createRepoConfig>;
  authConfig?: ReturnType<typeof createAuthConfig>;
}) {
  const fallbackDependencies = createCoreDependencies({
    ...(options.repoConfig ? { repoConfig: options.repoConfig } : {}),
    ...(options.authConfig ? { authConfig: options.authConfig } : {}),
  });

  return runOrfeCore(
    {
      callerName: 'Greg',
      command: options.command,
      input: options.input,
      ...options.request,
    },
    options.dependencies ?? fallbackDependencies,
  );
}

export function createToolDependencies(options: {
  repoConfig?: ReturnType<typeof createRepoConfig>;
  authConfig?: ReturnType<typeof createAuthConfig>;
  overrides?: OrfeToolDependencies;
} = {}): OrfeToolDependencies {
  return {
    loadRepoConfigImpl: async () => options.repoConfig ?? createRepoConfig(),
    loadAuthConfigImpl: async () => options.authConfig ?? createAuthConfig(),
    githubClientFactory: createGitHubClientFactory(),
    ...options.overrides,
  };
}

export async function runToolCommand(options: {
  input: Record<string, unknown>;
  context?: OpenCodeToolContext;
  dependencies?: OrfeToolDependencies;
  repoConfig?: ReturnType<typeof createRepoConfig>;
  authConfig?: ReturnType<typeof createAuthConfig>;
}) {
  const fallbackDependencies = createToolDependencies({
    ...(options.repoConfig ? { repoConfig: options.repoConfig } : {}),
    ...(options.authConfig ? { authConfig: options.authConfig } : {}),
  });

  return executeOrfeTool(
    options.input,
    {
      agent: 'Greg',
      cwd: '/tmp/repo',
      ...options.context,
    },
    options.dependencies ?? fallbackDependencies,
  );
}

export { createRepoConfig, createRepoConfigWithDefaultProject, createAuthConfig };
