import { Octokit } from 'octokit';

import { createOctokitLog } from '../logging/octokit-log.js';
import type { Logger } from '../logging/logger.js';

import { createGitHubAppJwt } from './jwt.js';
import { createInstallationAuth } from './app-installation-auth.js';
import {
  GITHUB_API_VERSION,
  type GitHubClientFactoryDependencies,
  type GitHubClients,
  type GitHubOctokitOptions,
} from './types.js';

import type { GitHubAppBotAuthConfig } from '../config/types.js';
import type { RepoRef } from '../config/repo/ref.js';

const USER_AGENT = 'orfe/0.1.2';

export { GITHUB_API_VERSION };
export type { GitHubOctokitOptions } from './types.js';

export class GitHubClientFactory {
  private readonly readFileImpl;
  private readonly octokitFactory;
  private readonly jwtFactory;

  constructor(dependencies: GitHubClientFactoryDependencies = {}) {
    this.readFileImpl = dependencies.readFileImpl;
    this.octokitFactory = dependencies.octokitFactory ?? defaultOctokitFactory;
    this.jwtFactory = dependencies.jwtFactory ?? createGitHubAppJwt;
  }

  async createClient(botName: string, botAuth: GitHubAppBotAuthConfig, repo: RepoRef, logger?: Logger): Promise<GitHubClients> {
    const auth = await this.createInstallationAuth(botName, botAuth, repo, logger);
    const octokit = this.octokitFactory(createGitHubOctokitOptions(auth.token, logger));

    return {
      octokit,
      rest: octokit.rest,
      graphql: octokit.graphql,
      auth: {
        botName,
        appSlug: botAuth.appSlug,
        installationId: auth.installationId,
        token: auth.token,
        expiresAt: auth.expiresAt,
      },
    };
  }

  async createInstallationAuth(
    botName: string,
    botAuth: GitHubAppBotAuthConfig,
    repo: RepoRef,
    logger?: Logger,
  ) {
    return createInstallationAuth(
      {
        botName,
        botAuth,
        repo,
        ...(logger ? { logger } : {}),
      },
      {
        ...(this.readFileImpl ? { readFileImpl: this.readFileImpl } : {}),
        octokitFactory: this.octokitFactory,
        jwtFactory: this.jwtFactory,
      },
    );
  }
}

function defaultOctokitFactory(options: GitHubOctokitOptions = {}): Octokit {
  const octokit = new Octokit({
    userAgent: USER_AGENT,
    ...(options.auth ? { auth: options.auth } : {}),
    ...(options.log ? { log: options.log } : {}),
  });

  octokit.hook.before('request', async (options) => {
    options.headers['x-github-api-version'] = GITHUB_API_VERSION;
  });

  return octokit;
}

function createGitHubOctokitOptions(auth: string | undefined, logger: Logger | undefined): GitHubOctokitOptions {
  return {
    ...(auth ? { auth } : {}),
    ...(logger ? { log: createOctokitLog(logger) } : {}),
  };
}
