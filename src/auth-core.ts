import { getRoleConfig, loadConfig } from './config.js';
import { createDefaultProviderRegistry, type ProviderRegistry } from './provider-registry.js';
import type { AuthTokenRequest, LoadedConfig, TokenIssuer, TokenResult } from './types.js';

export interface AuthCoreOptions {
  configPath?: string;
  refreshSkewMs?: number;
}

export interface AuthCoreDependencies {
  loadConfigImpl?: (options?: { configPath?: string }) => Promise<LoadedConfig>;
  providerRegistry?: ProviderRegistry;
  now?: () => number;
}

interface CachedTokenEntry {
  token: TokenResult;
  expiresAtMs: number;
}

const DEFAULT_REFRESH_SKEW_MS = 60_000;

export class AuthCore implements TokenIssuer {
  private readonly configPath: string | undefined;
  private readonly refreshSkewMs: number;
  private readonly loadConfigImpl: (options?: { configPath?: string }) => Promise<LoadedConfig>;
  private readonly providerRegistry: ProviderRegistry;
  private readonly now: () => number;

  private configPromise?: Promise<LoadedConfig>;
  private readonly cachedTokens = new Map<string, CachedTokenEntry>();
  private readonly inFlightTokens = new Map<string, Promise<TokenResult>>();

  constructor(options: AuthCoreOptions = {}, dependencies: AuthCoreDependencies = {}) {
    this.configPath = options.configPath;
    this.refreshSkewMs = options.refreshSkewMs ?? DEFAULT_REFRESH_SKEW_MS;
    this.loadConfigImpl = dependencies.loadConfigImpl ?? loadConfig;
    this.providerRegistry = dependencies.providerRegistry ?? createDefaultProviderRegistry();
    this.now = dependencies.now ?? Date.now;
  }

  async getToken(request: AuthTokenRequest): Promise<TokenResult> {
    const cacheKey = createCacheKey(request.role, request.repo);

    if (!request.forceRefresh) {
      const cached = this.cachedTokens.get(cacheKey);

      if (cached && !this.isExpiringSoon(cached.expiresAtMs)) {
        return cached.token;
      }

      const inFlight = this.inFlightTokens.get(cacheKey);
      if (inFlight) {
        return inFlight;
      }
    }

    const tokenPromise = this.mintAndCacheToken(request);

    this.inFlightTokens.set(cacheKey, tokenPromise);

    try {
      return await tokenPromise;
    } finally {
      this.inFlightTokens.delete(cacheKey);
    }
  }

  private async mintAndCacheToken(request: AuthTokenRequest): Promise<TokenResult> {
    const config = await this.getConfig();
    const roleConfig = getRoleConfig(config, request.role);
    const provider = this.providerRegistry.get(roleConfig.provider.kind);

    const token = await provider.mintToken({
      role: request.role,
      repo: request.repo,
      provider: roleConfig.provider,
    });

    this.cachedTokens.set(createCacheKey(request.role, request.repo), {
      token,
      expiresAtMs: Date.parse(token.expires_at),
    });

    return token;
  }

  private async getConfig(): Promise<LoadedConfig> {
    if (!this.configPromise) {
      this.configPromise = this.loadConfigImpl(this.configPath ? { configPath: this.configPath } : {});
    }

    return this.configPromise;
  }

  private isExpiringSoon(expiresAtMs: number): boolean {
    return !Number.isFinite(expiresAtMs) || expiresAtMs - this.now() <= this.refreshSkewMs;
  }
}

function createCacheKey(role: string, repo: string): string {
  return `${role}:${repo}`;
}
