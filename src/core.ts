import { getCommandDefinition, validateCommandInput } from './command-registry.js';
import { getRoleAuthConfig, loadAuthConfig, loadRepoConfig, resolveCallerRole, resolveRepository } from './config.js';
import { OrfeError } from './errors.js';
import { GitHubClientFactory } from './github.js';
import { createSuccessResponse } from './response.js';
import type { GitHubClients, MachineAuthConfig, OrfeCoreRequest, RepoLocalConfig, SuccessResponse } from './types.js';

export interface OrfeCoreDependencies {
  loadRepoConfigImpl?: typeof loadRepoConfig;
  loadAuthConfigImpl?: typeof loadAuthConfig;
  githubClientFactory?: GitHubClientFactory;
}

export async function runOrfeCore(
  request: OrfeCoreRequest,
  dependencies: OrfeCoreDependencies = {},
): Promise<SuccessResponse<unknown>> {
  const callerName = request.callerName.trim();
  if (callerName.length === 0) {
    throw new OrfeError('caller_name_missing', 'Caller name is required.');
  }

  const loadRepoConfigImpl = dependencies.loadRepoConfigImpl ?? loadRepoConfig;
  const loadAuthConfigImpl = dependencies.loadAuthConfigImpl ?? loadAuthConfig;
  const githubClientFactory = dependencies.githubClientFactory ?? new GitHubClientFactory();
  const commandDefinition = getCommandDefinition(request.command);
  const validatedInput = validateCommandInput(commandDefinition, request.input);
  const cwd = request.cwd ?? process.cwd();

  const repoConfig = await loadRepoConfigImpl({
    cwd,
    ...(request.configPath ? { configPath: request.configPath } : {}),
  });
  const authConfig = await loadAuthConfigImpl({
    cwd,
    ...(request.authConfigPath ? { authConfigPath: request.authConfigPath } : {}),
  });

  const callerRole = resolveCallerRole(repoConfig, callerName);
  const roleAuth = getRoleAuthConfig(authConfig, callerRole);
  const repo = resolveRepository(repoConfig, typeof validatedInput.repo === 'string' ? validatedInput.repo : undefined);
  let cachedGitHubClient: GitHubClients | undefined;

  const data = await commandDefinition.handler({
    callerName,
    callerRole,
    command: commandDefinition.name,
    input: validatedInput,
    repo,
    repoConfig,
    authConfig,
    roleAuth,
    getGitHubClient: async () => {
      cachedGitHubClient ??= await githubClientFactory.createClient(callerRole, roleAuth, repo);
      return cachedGitHubClient;
    },
  });

  return createSuccessResponse(commandDefinition.name, repo.fullName, data);
}

export interface RuntimeSnapshot {
  repoConfig: RepoLocalConfig;
  authConfig: MachineAuthConfig;
  callerRole: string;
}

export async function createRuntimeSnapshot(
  request: Pick<OrfeCoreRequest, 'callerName' | 'cwd' | 'configPath' | 'authConfigPath'>,
  dependencies: OrfeCoreDependencies = {},
): Promise<RuntimeSnapshot> {
  const loadRepoConfigImpl = dependencies.loadRepoConfigImpl ?? loadRepoConfig;
  const loadAuthConfigImpl = dependencies.loadAuthConfigImpl ?? loadAuthConfig;
  const cwd = request.cwd ?? process.cwd();
  const repoConfig = await loadRepoConfigImpl({
    cwd,
    ...(request.configPath ? { configPath: request.configPath } : {}),
  });
  const authConfig = await loadAuthConfigImpl({
    cwd,
    ...(request.authConfigPath ? { authConfigPath: request.authConfigPath } : {}),
  });
  const callerRole = resolveCallerRole(repoConfig, request.callerName);
  getRoleAuthConfig(authConfig, callerRole);

  return {
    repoConfig,
    authConfig,
    callerRole,
  };
}
