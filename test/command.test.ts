import assert from 'node:assert/strict';
import test from 'node:test';

import { runCli } from '../src/command.js';
import { ProviderRegistry } from '../src/provider-registry.js';
import type { LoadedConfig, TokenProvider, TokenRequest, TokenResult } from '../src/types.js';

class MemoryStream {
  output = '';

  write(chunk: string): boolean {
    this.output += chunk;
    return true;
  }
}

class MockProvider implements TokenProvider {
  readonly kind = 'github-app' as const;

  async mintToken(request: TokenRequest): Promise<TokenResult> {
    return {
      token: 'token-value',
      expires_at: '2026-03-30T21:30:00Z',
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

test('runCli writes token JSON to stdout on success', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();
  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(new MockProvider());

  const exitCode = await runCli(['token', '--role', 'greg', '--repo', 'throw-if-null/orfe', '--format', 'json'], {
    stdout,
    stderr,
    loadConfigImpl: async () => createLoadedConfig(),
    providerRegistry,
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr.output, '');
  assert.deepEqual(JSON.parse(stdout.output), {
    token: 'token-value',
    expires_at: '2026-03-30T21:30:00Z',
    role: 'greg',
    app_slug: 'GR3G-BOT',
    repo: 'throw-if-null/orfe',
    auth_mode: 'github-app',
  });
});

test('runCli sends failures to stderr only', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['token', '--role', 'unknown', '--repo', 'throw-if-null/orfe', '--format', 'json'], {
    stdout,
    stderr,
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /Invalid role "unknown"/);
});

test('runCli rejects unsupported output formats', async () => {
  const stdout = new MemoryStream();
  const stderr = new MemoryStream();

  const exitCode = await runCli(['token', '--role', 'greg', '--repo', 'throw-if-null/orfe', '--format', 'text'], {
    stdout,
    stderr,
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, '');
  assert.match(stderr.output, /supports json only/);
});
