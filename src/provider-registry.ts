import { TokennerError } from './errors.js';
import { GitHubAppTokenProvider, type GitHubAppProviderDependencies } from './github-app-provider.js';
import type { ProviderKind, TokenProvider } from './types.js';

export class ProviderRegistry {
  private readonly providers = new Map<ProviderKind, TokenProvider>();

  register(provider: TokenProvider): void {
    this.providers.set(provider.kind, provider);
  }

  get(kind: ProviderKind): TokenProvider {
    const provider = this.providers.get(kind);

    if (!provider) {
      throw new TokennerError(`No provider registered for "${kind}".`);
    }

    return provider;
  }
}

export function createDefaultProviderRegistry(
  dependencies: { githubApp?: GitHubAppProviderDependencies } = {},
): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new GitHubAppTokenProvider(dependencies.githubApp));
  return registry;
}
