import assert from 'node:assert/strict';
import test from 'node:test';

import { GitHubAppTokenProvider } from '../src/github-app-provider.js';

test('GitHubAppTokenProvider resolves the installation and mints an access token', async () => {
  const calls: Array<{ input: string; init: RequestInit }> = [];
  const provider = new GitHubAppTokenProvider({
    readFileImpl: async () => 'private-key',
    createAppJwt: () => 'jwt-token',
    fetchImpl: async (input, init) => {
      calls.push({ input, init });

      if (input.endsWith('/repos/throw-if-null/orfe/installation')) {
        return new Response(JSON.stringify({ id: 42 }), { status: 200 });
      }

      return new Response(JSON.stringify({ token: 'ghs_123', expires_at: '2026-03-30T21:30:00Z' }), { status: 201 });
    },
  });

  const result = await provider.mintToken({
    role: 'greg',
    repo: 'throw-if-null/orfe',
    provider: {
      kind: 'github-app',
      appId: '123456',
      appSlug: 'GR3G-BOT',
      privateKeyPath: '/tmp/greg.pem',
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.input, 'https://api.github.com/repos/throw-if-null/orfe/installation');
  assert.equal(calls[1]?.input, 'https://api.github.com/app/installations/42/access_tokens');
  assert.equal((calls[0]?.init.headers as Record<string, string>).Authorization, 'Bearer jwt-token');
  assert.deepEqual(result, {
    token: 'ghs_123',
    expires_at: '2026-03-30T21:30:00Z',
    role: 'greg',
    app_slug: 'GR3G-BOT',
    repo: 'throw-if-null/orfe',
    auth_mode: 'github-app',
  });
});

test('GitHubAppTokenProvider reports missing installations clearly', async () => {
  const provider = new GitHubAppTokenProvider({
    readFileImpl: async () => 'private-key',
    createAppJwt: () => 'jwt-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }),
  });

  await assert.rejects(
    provider.mintToken({
      role: 'greg',
      repo: 'throw-if-null/orfe',
      provider: {
        kind: 'github-app',
        appId: '123456',
        appSlug: 'GR3G-BOT',
        privateKeyPath: '/tmp/greg.pem',
      },
    }),
    /No GitHub App installation found/,
  );
});
