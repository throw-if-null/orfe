import type { Octokit } from 'octokit';

export const ORFE_COMMANDS = [
  'issue.get',
  'issue.create',
  'issue.update',
  'issue.comment',
  'issue.set-state',
  'pr.get',
  'pr.get-or-create',
  'pr.comment',
  'pr.submit-review',
  'pr.reply',
  'project.get-status',
  'project.set-status',
] as const;

export type OrfeCommandName = (typeof ORFE_COMMANDS)[number];
export type OrfeCommandGroup = 'issue' | 'pr' | 'project';
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
      owner: string;
      projectNumber: number;
      statusFieldName: string;
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
  command: OrfeCommandName | string;
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

export interface CommandContext {
  callerName: string;
  callerRole: string;
  command: OrfeCommandName;
  input: CommandInput;
  repo: RepoRef;
  repoConfig: RepoLocalConfig;
  authConfig: MachineAuthConfig;
  roleAuth: GitHubAppRoleAuthConfig;
  getGitHubClient(): Promise<GitHubClients>;
}
