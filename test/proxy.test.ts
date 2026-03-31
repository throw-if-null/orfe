import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';

import { GitHubMcpProxy, startGitHubMcpProxy } from '../src/proxy.js';
import type { AuthTokenRequest, TokenIssuer, TokenResult } from '../src/types.js';

class StubTokenIssuer implements TokenIssuer {
  readonly calls: Array<{ role: string; repo: string }> = [];

  async getToken(request: AuthTokenRequest): Promise<TokenResult> {
    this.calls.push(request);

    return {
      token: `token-for-${request.role}`,
      expires_at: '2026-03-31T10:00:00Z',
      role: request.role,
      app_slug: `${request.role.toUpperCase()}-BOT`,
      repo: request.repo,
      auth_mode: 'github-app',
    };
  }
}

test('GitHubMcpProxy injects bearer auth and pins MCP sessions to roles', async () => {
  const issuer = new StubTokenIssuer();
  const seenHeaders: Array<{ authorization: string | null; sessionId: string | null }> = [];
  const proxy = new GitHubMcpProxy(
    {
      repo: 'throw-if-null/orfe',
      remoteBaseUrl: 'https://example.test/mcp/',
    },
    {
      tokenIssuer: issuer,
      fetchImpl: async (_input, init) => {
        const headers = new Headers(init.headers);
        seenHeaders.push({
          authorization: headers.get('authorization'),
          sessionId: headers.get('mcp-session-id'),
        });

        return new Response(JSON.stringify({ jsonrpc: '2.0', result: { ok: true }, id: 1 }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'mcp-session-id': 'session-1',
          },
        });
      },
    },
  );

  const first = await invokeProxy(proxy, {
    method: 'POST',
    path: '/greg',
    body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
    headers: {
      'content-type': 'application/json',
    },
  });

  assert.equal(first.status, 200);
  assert.equal(first.headers.get('mcp-session-id'), 'session-1');
  assert.equal(seenHeaders[0]?.authorization, 'Bearer token-for-greg');
  assert.equal(issuer.calls.length, 1);

  const second = await invokeProxy(proxy, {
    method: 'POST',
    path: '/greg',
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 2 }),
    headers: {
      'content-type': 'application/json',
      'mcp-session-id': 'session-1',
    },
  });

  assert.equal(second.status, 200);

  const conflict = await invokeProxy(proxy, {
    method: 'POST',
    path: '/jelena',
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 3 }),
    headers: {
      'content-type': 'application/json',
      'mcp-session-id': 'session-1',
    },
  });

  assert.equal(conflict.status, 409);
});

test('GitHubMcpProxy keeps session-role pinning after upstream 404 responses', async () => {
  const issuer = new StubTokenIssuer();
  let requestCount = 0;
  const proxy = new GitHubMcpProxy(
    {
      repo: 'throw-if-null/orfe',
      remoteBaseUrl: 'https://example.test/mcp/',
    },
    {
      tokenIssuer: issuer,
      fetchImpl: async (_input, init) => {
        requestCount += 1;
        const headers = new Headers(init.headers);

        if (requestCount === 1) {
          return new Response(JSON.stringify({ jsonrpc: '2.0', result: { ok: true }, id: 1 }), {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'mcp-session-id': 'session-404',
            },
          });
        }

        assert.equal(headers.get('mcp-session-id'), 'session-404');

        return new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    },
  );

  const initialize = await invokeProxy(proxy, {
    method: 'POST',
    path: '/greg',
    body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
    headers: {
      'content-type': 'application/json',
    },
  });

  assert.equal(initialize.status, 200);
  assert.equal(initialize.headers.get('mcp-session-id'), 'session-404');

  const notFound = await invokeProxy(proxy, {
    method: 'POST',
    path: '/greg',
    body: JSON.stringify({ jsonrpc: '2.0', method: 'resources/read', id: 2 }),
    headers: {
      'content-type': 'application/json',
      'mcp-session-id': 'session-404',
    },
  });

  assert.equal(notFound.status, 404);

  const conflict = await invokeProxy(proxy, {
    method: 'POST',
    path: '/jelena',
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 3 }),
    headers: {
      'content-type': 'application/json',
      'mcp-session-id': 'session-404',
    },
  });

  assert.equal(conflict.status, 409);
});

test('GitHubMcpProxy releases session-role pinning only after explicit delete', async () => {
  const issuer = new StubTokenIssuer();
  let deleted = false;
  const proxy = new GitHubMcpProxy(
    {
      repo: 'throw-if-null/orfe',
      remoteBaseUrl: 'https://example.test/mcp/',
    },
    {
      tokenIssuer: issuer,
      fetchImpl: async (_input, init) => {
        const headers = new Headers(init.headers);
        const sessionId = headers.get('mcp-session-id');

        if (!sessionId) {
          return new Response(JSON.stringify({ jsonrpc: '2.0', result: { ok: true }, id: 1 }), {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'mcp-session-id': 'session-delete',
            },
          });
        }

        if (init.method === 'DELETE') {
          deleted = true;
          return new Response(null, { status: 204 });
        }

        return new Response(JSON.stringify({ ok: deleted }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    },
  );

  const initialize = await invokeProxy(proxy, {
    method: 'POST',
    path: '/greg',
    body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
    headers: {
      'content-type': 'application/json',
    },
  });

  assert.equal(initialize.status, 200);

  const conflictBeforeDelete = await invokeProxy(proxy, {
    method: 'POST',
    path: '/jelena',
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 2 }),
    headers: {
      'content-type': 'application/json',
      'mcp-session-id': 'session-delete',
    },
  });

  assert.equal(conflictBeforeDelete.status, 409);

  const deletedResponse = await invokeProxy(proxy, {
    method: 'DELETE',
    path: '/greg',
    headers: {
      'mcp-session-id': 'session-delete',
    },
  });

  assert.equal(deletedResponse.status, 204);

  const rebound = await invokeProxy(proxy, {
    method: 'POST',
    path: '/jelena',
    body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 3 }),
    headers: {
      'content-type': 'application/json',
      'mcp-session-id': 'session-delete',
    },
  });

  assert.equal(rebound.status, 200);
});

test('startGitHubMcpProxy binds locally and forwards requests', async () => {
  const issuer = new StubTokenIssuer();
  const upstreamRequests: Array<{ url: string; authorization: string | null }> = [];
  const upstream = createServer((request, response) => {
    upstreamRequests.push({
      url: request.url ?? '',
      authorization: request.headers.authorization ?? null,
    });
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json');
    response.setHeader('mcp-session-id', 'local-session');
    response.end(JSON.stringify({ jsonrpc: '2.0', result: { ok: true }, id: 1 }));
  });

  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const address = upstream.address();

  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP address for upstream test server.');
  }

  const started = await startGitHubMcpProxy(
    {
      repo: 'throw-if-null/orfe',
      host: '127.0.0.1',
      port: 0,
      remoteBaseUrl: `http://127.0.0.1:${address.port}/mcp/`,
    },
    {
      tokenIssuer: issuer,
    },
  );

  try {
    const response = await fetch(`${started.url}/klarissa`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('mcp-session-id'), 'local-session');
    assert.equal(upstreamRequests[0]?.url, '/mcp');
    assert.equal(upstreamRequests[0]?.authorization, 'Bearer token-for-klarissa');
  } finally {
    await started.close();
    upstream.close();
  }
});

test('startGitHubMcpProxy rejects non-loopback hosts', async () => {
  await assert.rejects(
    startGitHubMcpProxy({ repo: 'throw-if-null/orfe', host: '0.0.0.0' }),
    /loopback-only/,
  );
});

async function invokeProxy(
  proxy: GitHubMcpProxy,
  options: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<Response> {
  const server = createServer((request, response) => {
    void proxy.handleRequest(request, response);
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP address for proxy server.');
  }

  try {
    return await fetch(`http://127.0.0.1:${address.port}${options.path}`, {
      method: options.method,
      ...(options.headers ? { headers: options.headers } : {}),
      ...(options.body ? { body: options.body } : {}),
    });
  } finally {
    server.close();
  }
}
