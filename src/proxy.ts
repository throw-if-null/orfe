import { createServer, type IncomingHttpHeaders, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

import { AuthCore } from './auth-core.js';
import { TokennerError } from './errors.js';
import { SUPPORTED_ROLES, type Role, type TokenIssuer } from './types.js';

const DEFAULT_PROXY_HOST = '127.0.0.1';
const DEFAULT_PROXY_PORT = 8787;
const DEFAULT_REMOTE_BASE_URL = 'https://api.githubcopilot.com/mcp/';
const GITHUB_MCP_TOOLSETS_HEADER = 'x-mcp-toolsets';
export const DEFAULT_GITHUB_MCP_TOOLSETS = 'context,issues,pull_requests,projects';
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface GitHubMcpProxyOptions {
  repo: string;
  host?: string;
  port?: number;
  remoteBaseUrl?: string;
  configPath?: string;
  refreshSkewMs?: number;
}

export interface GitHubMcpProxyDependencies {
  tokenIssuer?: TokenIssuer;
  fetchImpl?: FetchLike;
}

export interface StartedGitHubMcpProxy {
  host: string;
  port: number;
  url: string;
  close(): Promise<void>;
  waitUntilClosed(): Promise<void>;
}

interface RoleRoute {
  role: Role;
  upstreamPath: string;
  search: string;
}

export class GitHubMcpProxy {
  private readonly repo: string;
  private readonly remoteBaseUrl: string;
  private readonly tokenIssuer: TokenIssuer;
  private readonly fetchImpl: FetchLike;
  private readonly sessionRoles = new Map<string, Role>();

  constructor(options: GitHubMcpProxyOptions, dependencies: GitHubMcpProxyDependencies = {}) {
    this.repo = options.repo;
    this.remoteBaseUrl = options.remoteBaseUrl ?? DEFAULT_REMOTE_BASE_URL;
    this.tokenIssuer =
      dependencies.tokenIssuer ??
      new AuthCore(
        {
          ...(options.configPath ? { configPath: options.configPath } : {}),
          ...(options.refreshSkewMs !== undefined ? { refreshSkewMs: options.refreshSkewMs } : {}),
        },
      );
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? 'GET';

    if (!isSupportedMethod(method)) {
      this.writeTextResponse(response, 405, 'Method Not Allowed');
      return;
    }

    const route = parseRoleRoute(request.url ?? '/');

    if (!route) {
      this.writeTextResponse(
        response,
        404,
        `Unknown endpoint. Use one of /${SUPPORTED_ROLES.join(', /')}.`,
      );
      return;
    }

    const incomingSessionId = getHeaderValue(request.headers['mcp-session-id']);
    const pinnedRole = incomingSessionId ? this.sessionRoles.get(incomingSessionId) : undefined;

    if (incomingSessionId && pinnedRole && pinnedRole !== route.role) {
      this.writeTextResponse(response, 409, `MCP session is pinned to role ${pinnedRole}.`);
      return;
    }

    try {
      const token = await this.tokenIssuer.getToken({
        role: route.role,
        repo: this.repo,
      });
      const body = await readRequestBody(request);
      const upstreamResponse = await this.fetchImpl(buildUpstreamUrl(this.remoteBaseUrl, route), {
        method,
        headers: createUpstreamHeaders(request.headers, token.token),
        ...(body ? { body } : {}),
      });

      const responseSessionId = upstreamResponse.headers.get('mcp-session-id');
      if (responseSessionId) {
        this.bindSessionRole(responseSessionId, route.role);
      }

      if (method === 'DELETE' && incomingSessionId) {
        this.sessionRoles.delete(incomingSessionId);
      }

      await writeProxyResponse(response, upstreamResponse);
    } catch (error) {
      this.writeTextResponse(response, 502, formatProxyError(error));
    }
  }

  private bindSessionRole(sessionId: string, role: Role): void {
    const existingRole = this.sessionRoles.get(sessionId);

    if (existingRole && existingRole !== role) {
      throw new TokennerError(`MCP session is already pinned to role ${existingRole}.`);
    }

    this.sessionRoles.set(sessionId, role);
  }

  private writeTextResponse(response: ServerResponse, statusCode: number, message: string): void {
    response.statusCode = statusCode;
    response.setHeader('content-type', 'text/plain; charset=utf-8');
    response.end(`${message}\n`);
  }
}

export async function startGitHubMcpProxy(
  options: GitHubMcpProxyOptions,
  dependencies: GitHubMcpProxyDependencies = {},
): Promise<StartedGitHubMcpProxy> {
  const host = assertLocalHost(options.host ?? DEFAULT_PROXY_HOST);
  const port = options.port ?? DEFAULT_PROXY_PORT;
  const proxy = new GitHubMcpProxy({ ...options, host, port }, dependencies);
  const server = createServer((request, response) => {
    void proxy.handleRequest(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  return createStartedProxy(server, host, port);
}

export function formatProxyListenMessage(startedProxy: StartedGitHubMcpProxy): string {
  return [
    `GitHub MCP proxy listening at ${startedProxy.url}`,
    ...SUPPORTED_ROLES.map((role) => `  - ${role}: ${startedProxy.url}/${role}`),
  ].join('\n');
}

function createStartedProxy(server: Server, host: string, port: number): StartedGitHubMcpProxy {
  const address = server.address();
  const resolvedPort = typeof address === 'object' && address ? (address as AddressInfo).port : port;

  return {
    host,
    port: resolvedPort,
    url: `http://${formatHostForUrl(host)}:${resolvedPort}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
    waitUntilClosed: async () => {
      if (!server.listening) {
        return;
      }

      await new Promise<void>((resolve) => {
        server.once('close', resolve);
      });
    },
  };
}

function assertLocalHost(host: string): string {
  if (host === '127.0.0.1' || host === 'localhost' || host === '::1') {
    return host;
  }

  throw new TokennerError(`Proxy host must be loopback-only. Received: ${host}`);
}

function formatHostForUrl(host: string): string {
  return host.includes(':') ? `[${host}]` : host;
}

function parseRoleRoute(rawUrl: string): RoleRoute | undefined {
  const parsed = new URL(rawUrl, 'http://localhost');
  const pathnameParts = parsed.pathname.split('/').filter((part) => part.length > 0);
  const firstPart = pathnameParts[0];

  if (!firstPart || !isRole(firstPart)) {
    return undefined;
  }

  const remainingPath = pathnameParts.slice(1).join('/');

  return {
    role: firstPart,
    upstreamPath: remainingPath.length > 0 ? `/${remainingPath}` : '/',
    search: parsed.search,
  };
}

function isRole(value: string): value is Role {
  return (SUPPORTED_ROLES as readonly string[]).includes(value);
}

function isSupportedMethod(method: string): boolean {
  return method === 'GET' || method === 'POST' || method === 'DELETE';
}

function buildUpstreamUrl(remoteBaseUrl: string, route: RoleRoute): string {
  const upstream = new URL(remoteBaseUrl);
  const basePath = upstream.pathname.endsWith('/') ? upstream.pathname.slice(0, -1) : upstream.pathname;
  const suffix = route.upstreamPath === '/' ? '' : route.upstreamPath;

  upstream.pathname = `${basePath}${suffix}`;
  upstream.search = route.search;

  return upstream.toString();
}

function createUpstreamHeaders(headers: IncomingHttpHeaders, bearerToken: string): Headers {
  const upstreamHeaders = new Headers();

  for (const [key, rawValue] of Object.entries(headers)) {
    if (rawValue === undefined) {
      continue;
    }

    const normalizedKey = key.toLowerCase();
    if (normalizedKey === 'authorization' || HOP_BY_HOP_HEADERS.has(normalizedKey)) {
      continue;
    }

    const headerValue = Array.isArray(rawValue) ? rawValue.join(', ') : rawValue;
    upstreamHeaders.set(key, headerValue);
  }

  upstreamHeaders.set('authorization', `Bearer ${bearerToken}`);
  upstreamHeaders.set(GITHUB_MCP_TOOLSETS_HEADER, DEFAULT_GITHUB_MCP_TOOLSETS);
  return upstreamHeaders;
}

async function readRequestBody(request: IncomingMessage): Promise<Blob | undefined> {
  if (request.method === 'GET' || request.method === 'DELETE') {
    return undefined;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return new Blob([Buffer.concat(chunks)]);
}

async function writeProxyResponse(response: ServerResponse, upstreamResponse: Response): Promise<void> {
  response.statusCode = upstreamResponse.status;

  upstreamResponse.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      response.setHeader(key, value);
    }
  });

  if (!upstreamResponse.body) {
    response.end();
    return;
  }

  await pipeline(Readable.fromWeb(upstreamResponse.body as unknown as NodeReadableStream), response);
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  return value?.[0];
}

function formatProxyError(error: unknown): string {
  if (error instanceof TokennerError) {
    return error.message;
  }

  if (error instanceof Error) {
    return `Proxy request failed: ${error.message}`;
  }

  return 'Proxy request failed.';
}
