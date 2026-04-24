import { getCommandDefinition, validateCommandInput } from './commands/registry/index.js';
import { getBotAuthConfig, loadAuthConfig, loadRepoConfig, resolveCallerBot, resolveRepository } from './config.js';
import { OrfeError } from './errors.js';
import { GitHubClientFactory } from './github.js';
import { createLogger } from './logger.js';
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
  const commandDefinition = getCommandDefinition(request.command);
  const validatedInput = validateCommandInput(commandDefinition, request.input);
  const entrypoint = request.entrypoint ?? 'cli';

  if (commandDefinition.execution === 'runtime') {
    if ((commandDefinition.requiresCaller ?? true) && request.callerName.trim().length === 0) {
      throw new OrfeError('caller_name_missing', 'Caller name is required.');
    }

    const data = await commandDefinition.runtimeHandler({
      command: commandDefinition.name,
      input: validatedInput,
      entrypoint,
    });

    return createSuccessResponse(commandDefinition.name, undefined, data);
  }

  const callerName = request.callerName.trim();
  if (callerName.length === 0) {
    throw new OrfeError('caller_name_missing', 'Caller name is required.');
  }

  const loadRepoConfigImpl = dependencies.loadRepoConfigImpl ?? loadRepoConfig;
  const loadAuthConfigImpl = dependencies.loadAuthConfigImpl ?? loadAuthConfig;
  const githubClientFactory = dependencies.githubClientFactory ?? new GitHubClientFactory();
  const cwd = request.cwd ?? process.cwd();
  const logger = request.logger ?? createLogger();

  const repoConfig = await loadRepoConfigImpl({
    cwd,
    ...(request.configPath ? { configPath: request.configPath } : {}),
  });
  const authConfig = await loadAuthConfigImpl({
    cwd,
    ...(request.authConfigPath ? { authConfigPath: request.authConfigPath } : {}),
  });

  const callerBot = resolveRequiredCallerBot(repoConfig, callerName);
  const botAuth = getBotAuthConfig(authConfig, callerBot);
  const repo = resolveRepository(repoConfig, typeof validatedInput.repo === 'string' ? validatedInput.repo : undefined);
  let cachedGitHubClient: GitHubClients | undefined;
  let cachedGitHubAuth: GitHubClients['auth'] | undefined;

  const data = await commandDefinition.handler({
    callerName,
    callerBot,
    command: commandDefinition.name,
    input: validatedInput,
    repo,
    repoConfig,
    authConfig,
    botAuth,
    logger,
    getGitHubClient: async () => {
      cachedGitHubClient ??= await githubClientFactory.createClient(callerBot, botAuth, repo, logger);
      return cachedGitHubClient;
    },
    getGitHubAuth: async () => {
      if (cachedGitHubClient) {
        return cachedGitHubClient.auth;
      }

        cachedGitHubAuth ??= {
          botName: callerBot,
          appSlug: botAuth.appSlug,
          ...(await githubClientFactory.createInstallationAuth(callerBot, botAuth, repo, logger)),
        };

      return cachedGitHubAuth;
    },
  });

  return createSuccessResponse(commandDefinition.name, repo.fullName, data);
}

function resolveRequiredCallerBot(config: RepoLocalConfig, callerName: string): string {
  if (callerName.length === 0) {
    throw new OrfeError('caller_name_missing', 'Caller name is required.');
  }

  return resolveCallerBot(config, callerName);
}

export interface RuntimeSnapshot {
  repoConfig: RepoLocalConfig;
  authConfig: MachineAuthConfig;
  callerBot: string;
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
  const callerBot = resolveRequiredCallerBot(repoConfig, request.callerName.trim());
  getBotAuthConfig(authConfig, callerBot);

  return {
    repoConfig,
    authConfig,
    callerBot,
  };
}
