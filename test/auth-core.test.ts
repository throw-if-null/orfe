import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthCore } from '../src/auth-core.js';
import { ProviderRegistry } from '../src/provider-registry.js';
import type { LoadedConfig, TokenProvider, TokenRequest, TokenResult } from '../src/types.js';

class CountingProvider implements TokenProvider {
  readonly kind = 'github-app' as const;
  calls = 0;

  async mintToken(request: TokenRequest): Promise<TokenResult> {
    this.calls += 1;

    return {
      token: `token-${this.calls}`,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      role: request.role,
      app_slug: request.provider.appSlug,
      repo: request.repo,
      auth_mode: 'github-app',
    };
  }
}

function createLoadedConfig(): LoadedConfig {
  return {
    configPath: '/tmp/apps.yaml',
    roles: {
      greg: {
        role: 'greg',
        provider: {
          kind: 'github-app',
          appId: '123456',
          appSlug: 'GR3G-BOT',
          privateKeyPath: '/tmp/greg.pem',
        },
      },
    },
  };
}

test('AuthCore caches tokens until they are near expiry', async () => {
  const provider = new CountingProvider();
  const registry = new ProviderRegistry();
  registry.register(provider);
  const authCore = new AuthCore(
    {
      refreshSkewMs: 60_000,
    },
    {
      loadConfigImpl: async () => createLoadedConfig(),
      providerRegistry: registry,
    },
  );

  const first = await authCore.getToken({ role: 'greg', repo: 'throw-if-null/orfe' });
  const second = await authCore.getToken({ role: 'greg', repo: 'throw-if-null/orfe' });

  assert.equal(provider.calls, 1);
  assert.equal(second.token, first.token);
});

test('AuthCore refreshes tokens that are within refresh skew', async () => {
  const registry = new ProviderRegistry();
  let now = Date.parse('2026-03-31T00:00:00.000Z');
  let calls = 0;

  registry.register({
    kind: 'github-app',
    async mintToken(request: TokenRequest): Promise<TokenResult> {
      calls += 1;

      return {
        token: `token-${calls}`,
        expires_at: new Date(now + 30_000).toISOString(),
        role: request.role,
        app_slug: request.provider.appSlug,
        repo: request.repo,
        auth_mode: 'github-app',
      };
    },
  });

  const authCore = new AuthCore(
    {
      refreshSkewMs: 60_000,
    },
    {
      now: () => now,
      loadConfigImpl: async () => createLoadedConfig(),
      providerRegistry: registry,
    },
  );

  const first = await authCore.getToken({ role: 'greg', repo: 'throw-if-null/orfe' });
  now += 5_000;
  const second = await authCore.getToken({ role: 'greg', repo: 'throw-if-null/orfe' });

  assert.equal(calls, 2);
  assert.notEqual(second.token, first.token);
});

test('AuthCore deduplicates concurrent token refreshes', async () => {
  const registry = new ProviderRegistry();
  let calls = 0;

  registry.register({
    kind: 'github-app',
    async mintToken(request: TokenRequest): Promise<TokenResult> {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));

      return {
        token: 'token-shared',
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        role: request.role,
        app_slug: request.provider.appSlug,
        repo: request.repo,
        auth_mode: 'github-app',
      };
    },
  });

  const authCore = new AuthCore(
    {},
    {
      loadConfigImpl: async () => createLoadedConfig(),
      providerRegistry: registry,
    },
  );

  const [first, second] = await Promise.all([
    authCore.getToken({ role: 'greg', repo: 'throw-if-null/orfe' }),
    authCore.getToken({ role: 'greg', repo: 'throw-if-null/orfe' }),
  ]);

  assert.equal(calls, 1);
  assert.equal(first.token, second.token);
});
