export interface RepoLocalConfig {
  configPath: string;
  version: 1;
  repository: {
    owner: string;
    name: string;
    defaultBranch: string;
  };
  callerToBot: Record<string, string>;
  projects?: {
    default?: {
      owner?: string;
      projectNumber?: number;
      statusFieldName?: string;
    };
  };
}

export interface GitHubAppBotAuthConfig {
  provider: 'github-app';
  appId: number;
  appSlug: string;
  privateKeyPath: string;
}

export interface MachineAuthConfig {
  configPath: string;
  version: 1;
  bots: Record<string, GitHubAppBotAuthConfig>;
}

export interface LoadRepoConfigOptions {
  cwd?: string;
  configPath?: string;
}

export interface LoadAuthConfigOptions {
  cwd?: string;
  authConfigPath?: string;
  homeDirectory?: string;
}

export interface ProjectCommandOptions {
  add_to_project?: unknown;
  project_owner?: unknown;
  project_number?: unknown;
  status_field_name?: unknown;
  status?: unknown;
}

export interface ResolvedProjectConfig {
  projectOwner: string;
  projectNumber: number;
  statusFieldName: string;
}
