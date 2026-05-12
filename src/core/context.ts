import type { GitHubAppBotAuthConfig, MachineAuthConfig, RepoLocalConfig } from '../config/shared.js';
import type { RepoRef } from '../config/repository-ref.js';
import type { GitHubClientAuthInfo, GitHubClients } from '../github/types.js';
import type { Logger } from '../logging/logger.js';

import type { CommandInput } from './types.js';

export interface CommandContext<TCommand extends string = string, TInput extends CommandInput = CommandInput> {
  callerName: string;
  callerBot: string;
  command: TCommand;
  input: TInput;
  repo: RepoRef;
  repoConfig: RepoLocalConfig;
  authConfig: MachineAuthConfig;
  botAuth: GitHubAppBotAuthConfig;
  logger: Logger;
  getGitHubClient(): Promise<GitHubClients>;
  getGitHubAuth(): Promise<GitHubClientAuthInfo>;
}
