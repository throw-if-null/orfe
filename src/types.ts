import type { Octokit } from 'octokit';

export type { OrfeCommandGroup, OrfeCommandName } from './commands/index.js';

export type CommandInput = Record<string, unknown>;

export interface RepoRef {
  owner: string;
  name: string;
  fullName: string;
}

export interface RepoLocalConfig {
  configPath: string;
  version: 1;
  repository: {
    owner: string;
    name: string;
    defaultBranch: string;
  };
  callerToGitHubRole: Record<string, string>;
  projects?: {
    default?: {
      owner?: string;
      projectNumber?: number;
      statusFieldName?: string;
    };
  };
}

export interface GitHubAppRoleAuthConfig {
  provider: 'github-app';
  appId: number;
  appSlug: string;
  privateKeyPath: string;
}

export interface MachineAuthConfig {
  configPath: string;
  version: 1;
  roles: Record<string, GitHubAppRoleAuthConfig>;
}

export interface GitHubClientAuthInfo {
  roleName: string;
  appSlug: string;
  installationId: number;
  token: string;
  expiresAt: string;
}

export interface GitHubClients {
  octokit: Octokit;
  rest: Octokit['rest'];
  graphql: Octokit['graphql'];
  auth: GitHubClientAuthInfo;
}

export interface OrfeCoreRequest {
  callerName: string;
  command: string;
  input: CommandInput;
  cwd?: string;
  configPath?: string;
  authConfigPath?: string;
}

export interface SuccessResponse<TData> {
  ok: true;
  command: string;
  repo: string;
  data: TData;
}

export interface ErrorResponse {
  ok: false;
  command: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface CommandContext<TCommand extends string = string, TInput extends CommandInput = CommandInput> {
  callerName: string;
  callerRole: string;
  command: TCommand;
  input: TInput;
  repo: RepoRef;
  repoConfig: RepoLocalConfig;
  authConfig: MachineAuthConfig;
  roleAuth: GitHubAppRoleAuthConfig;
  getGitHubClient(): Promise<GitHubClients>;
  getGitHubAuth(): Promise<GitHubClientAuthInfo>;
}
