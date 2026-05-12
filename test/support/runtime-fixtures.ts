import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GitHubClientFactory } from '../../src/github.js';

const supportDirectory = path.dirname(fileURLToPath(import.meta.url));

export const workspaceRoot = path.resolve(supportDirectory, '../..');
export const repoConfigPath = path.join(workspaceRoot, '.orfe', 'config.json');

export function createRepoConfig(options: { includeDefaultProject?: boolean } = {}) {
  const config = {
    configPath: repoConfigPath,
    version: 1 as const,
    repository: {
      owner: 'throw-if-null',
      name: 'orfe',
      defaultBranch: 'main',
    },
    callerToBot: {
      Greg: 'greg',
    },
  };

  if (!options.includeDefaultProject) {
    return config;
  }

  return {
    ...config,
    projects: {
      default: {
        owner: 'throw-if-null',
        projectNumber: 1,
        statusFieldName: 'Status',
      },
    },
  };
}

export function createRepoConfigWithDefaultProject() {
  return createRepoConfig({ includeDefaultProject: true });
}

export function createAuthConfig() {
  return {
    configPath: '/tmp/auth.json',
    version: 1 as const,
    bots: {
      greg: {
        provider: 'github-app' as const,
        appId: 123458,
        appSlug: 'GR3G-BOT',
        privateKeyPath: '/tmp/greg.pem',
      },
    },
  };
}

export function createGitHubClientFactory() {
  return new GitHubClientFactory({
    readFileImpl: async () => 'private-key',
    jwtFactory: () => 'jwt-token',
  });
}

export function renderIssueTemplateMarker(): string {
  return '<!-- orfe-template: issue/formal-work-item@1.0.0 -->';
}

export function renderPrTemplateMarker(): string {
  return '<!-- orfe-template: pr/implementation-ready@1.0.0 -->';
}
