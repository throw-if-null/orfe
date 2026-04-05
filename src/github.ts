import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { Octokit } from 'octokit';

import { OrfeError } from './errors.js';
import type { GitHubAppRoleAuthConfig, GitHubClients, RepoRef } from './types.js';

const GITHUB_API_VERSION = '2022-11-28';
const USER_AGENT = 'orfe/0.1.0';

interface InstallationResponse {
  id: number;
}

interface AccessTokenResponse {
  token: string;
  expires_at: string;
}

type ReadFileText = (filePath: string, encoding: 'utf8') => Promise<string>;

export interface GitHubClientFactoryDependencies {
  readFileImpl?: ReadFileText;
  octokitFactory?: (auth?: string) => Octokit;
  jwtFactory?: (appId: number, privateKey: string) => string;
}

export class GitHubClientFactory {
  private readonly readFileImpl: ReadFileText;
  private readonly octokitFactory: (auth?: string) => Octokit;
  private readonly jwtFactory: (appId: number, privateKey: string) => string;

  constructor(dependencies: GitHubClientFactoryDependencies = {}) {
    this.readFileImpl = dependencies.readFileImpl ?? readFile;
    this.octokitFactory = dependencies.octokitFactory ?? defaultOctokitFactory;
    this.jwtFactory = dependencies.jwtFactory ?? createGitHubAppJwt;
  }

  async createClient(roleName: string, roleAuth: GitHubAppRoleAuthConfig, repo: RepoRef): Promise<GitHubClients> {
    const privateKey = await readPrivateKey(roleAuth.privateKeyPath, this.readFileImpl);
    const appJwt = this.jwtFactory(roleAuth.appId, privateKey);
    const appOctokit = this.octokitFactory(appJwt);

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
        notFoundMessage: `No GitHub App installation for ${repo.fullName} was found for app ${roleAuth.appSlug}.`,
      });
    }

    let accessToken: AccessTokenResponse;

    try {
      const accessTokenResponse = await appOctokit.request('POST /app/installations/{installation_id}/access_tokens', {
        installation_id: installationId,
        headers: {
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
        },
      });
      accessToken = accessTokenResponse.data as AccessTokenResponse;
    } catch (error) {
      throw mapGitHubRequestError(error, {
        fallbackMessage: `Failed to mint an installation token for role "${roleName}" on ${repo.fullName}.`,
      });
    }

    const octokit = this.octokitFactory(accessToken.token);

    return {
      octokit,
      rest: octokit.rest,
      graphql: octokit.graphql,
      auth: {
        roleName,
        appSlug: roleAuth.appSlug,
        installationId,
        token: accessToken.token,
        expiresAt: accessToken.expires_at,
      },
    };
  }
}

export function createGitHubAppJwt(appId: number, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: String(appId),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();

  return `${unsignedToken}.${base64UrlEncode(signer.sign(privateKey))}`;
}

async function readPrivateKey(filePath: string, readFileImpl: ReadFileText): Promise<string> {
  try {
    return await readFileImpl(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new OrfeError('auth_failed', `Private key file not found at ${filePath}.`);
    }

    throw new OrfeError('auth_failed', `Unable to read private key file at ${filePath}.`);
  }
}

function defaultOctokitFactory(auth?: string): Octokit {
  return new Octokit({
    userAgent: USER_AGENT,
    ...(auth ? { auth } : {}),
  });
}

function mapGitHubRequestError(
  error: unknown,
  options: { notFoundMessage?: string; fallbackMessage?: string } = {},
): OrfeError {
  if (isRequestError(error)) {
    if (error.status === 404 && options.notFoundMessage) {
      return new OrfeError('auth_failed', options.notFoundMessage);
    }

    return new OrfeError(
      'auth_failed',
      options.fallbackMessage ?? `GitHub API request failed with status ${error.status}: ${error.message}`,
    );
  }

  if (error instanceof OrfeError) {
    return error;
  }

  if (error instanceof Error) {
    return new OrfeError('auth_failed', error.message);
  }

  return new OrfeError('auth_failed', 'Unknown GitHub authentication failure.');
}

function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input;
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isRequestError(error: unknown): error is Error & { status: number } {
  return error instanceof Error && 'status' in error && typeof (error as { status?: unknown }).status === 'number';
}
