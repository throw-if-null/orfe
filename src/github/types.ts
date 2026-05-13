import type { Octokit } from 'octokit';

import type { GitHubAppBotAuthConfig } from '../config/shared.js';
import type { RepoRef } from '../config/repository-ref.js';
import type { Logger } from '../logging/logger.js';
import type { OctokitLogAdapter } from '../logging/octokit-log.js';

export const GITHUB_API_VERSION = '2022-11-28';

export interface GitHubClientAuthInfo {
  botName: string;
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

export type ReadFileText = (filePath: string, encoding: 'utf8') => Promise<string>;

export interface GitHubOctokitOptions {
  auth?: string;
  log?: OctokitLogAdapter;
}

export type OctokitFactory = (options?: GitHubOctokitOptions) => Octokit;

export interface GitHubClientFactoryDependencies {
  readFileImpl?: ReadFileText;
  octokitFactory?: OctokitFactory;
  jwtFactory?: (appId: number, privateKey: string) => string;
}

export interface GitHubInstallationAuth {
  installationId: number;
  token: string;
  expiresAt: string;
}

export interface CreateInstallationAuthDependencies {
  readFileImpl?: ReadFileText;
  octokitFactory: OctokitFactory;
  jwtFactory?: (appId: number, privateKey: string) => string;
}

export interface CreateInstallationAuthOptions {
  botName: string;
  botAuth: GitHubAppBotAuthConfig;
  repo: RepoRef;
  logger?: Logger;
}
