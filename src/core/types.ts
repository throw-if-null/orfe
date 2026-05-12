import type { Logger } from '../logging/logger.js';
import type { RuntimeEntrypoint } from '../version.js';
import type { LoadAuthConfigOptions, LoadRepoConfigOptions, MachineAuthConfig, RepoLocalConfig } from '../config/shared.js';
import type { GitHubClientFactory } from '../github/client-factory.js';
import type { SuccessResponse } from '../runtime/response.js';

export type CommandInput = Record<string, unknown>;

type LoadRepoConfigFn = (options?: LoadRepoConfigOptions) => Promise<RepoLocalConfig>;
type LoadAuthConfigFn = (options?: LoadAuthConfigOptions) => Promise<MachineAuthConfig>;

export interface OrfeCoreRequest {
  callerName: string;
  command: string;
  input: CommandInput;
  entrypoint?: RuntimeEntrypoint;
  cwd?: string;
  configPath?: string;
  authConfigPath?: string;
  logger?: Logger;
}

export interface OrfeCoreDependencies {
  loadRepoConfigImpl?: LoadRepoConfigFn;
  loadAuthConfigImpl?: LoadAuthConfigFn;
  githubClientFactory?: GitHubClientFactory;
}

export type OrfeCoreResult = Promise<SuccessResponse<unknown>>;
