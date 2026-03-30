import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { TokennerError } from './errors.js';
import type { GitHubAppProviderConfig, TokenProvider, TokenRequest, TokenResult } from './types.js';

const GITHUB_API_URL = 'https://api.github.com';
const USER_AGENT = 'tokenner';

interface InstallationResponse {
  id: number;
}

interface AccessTokenResponse {
  token: string;
  expires_at: string;
}

interface GitHubErrorResponse {
  message?: string;
}

interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

type ReadTextFile = (filePath: string, encoding: 'utf8') => Promise<string>;

export interface GitHubAppProviderDependencies {
  fetchImpl?: (input: string, init: RequestInit) => Promise<FetchResponseLike>;
  readFileImpl?: ReadTextFile;
  createAppJwt?: (appId: string, privateKey: string) => string;
}

export class GitHubAppTokenProvider implements TokenProvider {
  readonly kind = 'github-app' as const;

  private readonly fetchImpl: (input: string, init: RequestInit) => Promise<FetchResponseLike>;
  private readonly readFileImpl: ReadTextFile;
  private readonly createAppJwt: (appId: string, privateKey: string) => string;

  constructor(dependencies: GitHubAppProviderDependencies = {}) {
    this.fetchImpl = dependencies.fetchImpl ?? defaultFetch;
    this.readFileImpl = dependencies.readFileImpl ?? readTextFile;
    this.createAppJwt = dependencies.createAppJwt ?? createGitHubAppJwt;
  }

  async mintToken(request: TokenRequest): Promise<TokenResult> {
    const { role, repo } = request;
    const provider = assertGitHubAppProviderConfig(request.provider);
    const [owner, name] = parseRepo(repo);

    let privateKey: string;

    try {
      privateKey = await this.readFileImpl(provider.privateKeyPath, 'utf8');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        throw new TokennerError(`Private key file not found at ${provider.privateKeyPath}.`);
      }

      throw new TokennerError(`Unable to read private key file at ${provider.privateKeyPath}.`);
    }

    const jwt = this.createAppJwt(provider.appId, privateKey);
    const installation = await this.requestJson<InstallationResponse>({
      path: `/repos/${owner}/${name}/installation`,
      method: 'GET',
      jwt,
      notFoundMessage: `No GitHub App installation found for ${repo} using app ${provider.appSlug}.`,
    });

    const accessToken = await this.requestJson<AccessTokenResponse>({
      path: `/app/installations/${installation.id}/access_tokens`,
      method: 'POST',
      jwt,
    });

    return {
      token: accessToken.token,
      expires_at: accessToken.expires_at,
      role,
      app_slug: provider.appSlug,
      repo,
      auth_mode: 'github-app',
    };
  }

  private async requestJson<T>(options: {
    path: string;
    method: 'GET' | 'POST';
    jwt: string;
    notFoundMessage?: string;
  }): Promise<T> {
    const response = await this.fetchImpl(`${GITHUB_API_URL}${options.path}`, {
      method: options.method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${options.jwt}`,
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      if (response.status === 404 && options.notFoundMessage) {
        throw new TokennerError(options.notFoundMessage);
      }

      const message = await readGitHubErrorMessage(response);
      throw new TokennerError(`GitHub API request failed with status ${response.status}: ${message}`);
    }

    return (await response.json()) as T;
  }
}

export function createGitHubAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(privateKey);
  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function defaultFetch(input: string, init: RequestInit): Promise<FetchResponseLike> {
  return fetch(input, init) as Promise<FetchResponseLike>;
}

async function readTextFile(filePath: string, encoding: 'utf8'): Promise<string> {
  return readFile(filePath, encoding);
}

async function readGitHubErrorMessage(response: FetchResponseLike): Promise<string> {
  try {
    const body = (await response.json()) as GitHubErrorResponse;
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // Fall back to text body below.
  }

  const text = await response.text();
  return text.length > 0 ? text : 'Unknown GitHub API error';
}

function parseRepo(repo: string): [string, string] {
  const parts = repo.split('/');

  if (parts.length !== 2 || parts[0]!.length === 0 || parts[1]!.length === 0) {
    throw new TokennerError(`Repository must be in "owner/name" format. Received: ${repo}`);
  }

  return [parts[0]!, parts[1]!];
}

function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input;
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function assertGitHubAppProviderConfig(provider: TokenRequest['provider']): GitHubAppProviderConfig {
  if (provider.kind !== 'github-app') {
    throw new TokennerError(`Unsupported provider "${provider.kind}".`);
  }

  return provider;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
