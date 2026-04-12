import { OrfeError } from './errors.js';
import type { CommandContext } from './types.js';

interface AuthTokenData {
  role: string;
  app_slug: string;
  repo: string;
  token: string;
  expires_at: string;
  auth_mode: 'github-app';
}

export async function handleAuthToken(context: CommandContext): Promise<AuthTokenData> {
  if (!context.requestedRole || !context.getGitHubAuth) {
    throw new OrfeError('internal_error', 'auth.token requires explicit role auth context.');
  }

  const auth = await context.getGitHubAuth();

  return {
    role: context.requestedRole,
    app_slug: context.roleAuth.appSlug,
    repo: context.repo.fullName,
    token: auth.token,
    expires_at: auth.expiresAt,
    auth_mode: context.roleAuth.provider,
  };
}
