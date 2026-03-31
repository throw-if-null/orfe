export const SUPPORTED_ROLES = ['zoran', 'jelena', 'greg', 'klarissa'] as const;

export type Role = (typeof SUPPORTED_ROLES)[number];
export type OutputFormat = 'json';
export type ProviderKind = 'github-app';
export type AuthMode = 'github-app';

export interface GitHubAppProviderConfig {
  kind: 'github-app';
  appId: string;
  appSlug: string;
  privateKeyPath: string;
}

export type ProviderConfig = GitHubAppProviderConfig;

export interface RoleConfig {
  role: Role;
  provider: ProviderConfig;
}

export interface LoadedConfig {
  configPath: string;
  roles: Partial<Record<Role, RoleConfig>>;
}

export interface TokenResult {
  token: string;
  expires_at: string;
  role: Role;
  app_slug: string;
  repo: string;
  auth_mode: AuthMode;
}

export interface TokenRequest {
  role: Role;
  repo: string;
  provider: ProviderConfig;
}

export interface TokenProvider {
  readonly kind: ProviderKind;
  mintToken(request: TokenRequest): Promise<TokenResult>;
}
