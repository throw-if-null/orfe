import { readFile } from 'node:fs/promises';

import { createOctokitLog } from '../logging/octokit-log.js';

import { createGitHubAppJwt } from './jwt.js';
import { mapGitHubRequestError, mapPrivateKeyReadError } from './errors.js';
import { GITHUB_API_VERSION, type CreateInstallationAuthDependencies, type CreateInstallationAuthOptions, type GitHubInstallationAuth } from './types.js';

interface InstallationResponse {
  id: number;
}

interface AccessTokenResponse {
  token: string;
  expires_at: string;
}

export async function createInstallationAuth(
  { botName, botAuth, repo, logger }: CreateInstallationAuthOptions,
  dependencies: CreateInstallationAuthDependencies,
): Promise<GitHubInstallationAuth> {
  const readFileImpl = dependencies.readFileImpl ?? readFile;
  const jwtFactory = dependencies.jwtFactory ?? createGitHubAppJwt;
  const privateKey = await readPrivateKey(botAuth.privateKeyPath, readFileImpl);
  const appJwt = jwtFactory(botAuth.appId, privateKey);
  const appOctokit = dependencies.octokitFactory(createGitHubOctokitOptions(appJwt, logger));

  let installationId: number;

  try {
    const installationResponse = await appOctokit.request('GET /repos/{owner}/{repo}/installation', {
      owner: repo.owner,
      repo: repo.name,
      headers: {
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    });
    installationId = (installationResponse.data as InstallationResponse).id;
  } catch (error) {
    throw mapGitHubRequestError(error, {
      notFoundMessage: `No GitHub App installation for ${repo.fullName} was found for app ${botAuth.appSlug}.`,
    });
  }

  try {
    const accessTokenResponse = await appOctokit.request('POST /app/installations/{installation_id}/access_tokens', {
      installation_id: installationId,
      headers: {
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    });
    const accessToken = accessTokenResponse.data as AccessTokenResponse;

    return {
      installationId,
      token: accessToken.token,
      expiresAt: accessToken.expires_at,
    };
  } catch (error) {
    throw mapGitHubRequestError(error, {
      fallbackMessage: `Failed to mint an installation token for bot "${botName}" on ${repo.fullName}.`,
    });
  }
}

async function readPrivateKey(filePath: string, readFileImpl: (filePath: string, encoding: 'utf8') => Promise<string>): Promise<string> {
  try {
    return await readFileImpl(filePath, 'utf8');
  } catch (error) {
    throw mapPrivateKeyReadError(error, filePath);
  }
}

function createGitHubOctokitOptions(auth: string | undefined, logger: CreateInstallationAuthOptions['logger']) {
  return {
    ...(auth ? { auth } : {}),
    ...(logger ? { log: createOctokitLog(logger) } : {}),
  };
}
