import { OrfeError } from '../../../errors.js';
import type { CommandContext } from '../../../types.js';

export interface AuthTokenData {
  bot: string;
  app_slug: string;
  repo: string;
  token: string;
  expires_at: string;
  auth_mode: 'github-app';
}

export async function handleAuthToken(context: CommandContext<'auth token'>): Promise<AuthTokenData> {
  if (context.command !== 'auth token') {
    throw new OrfeError('internal_error', 'auth token handler received an unexpected command context.');
  }

  const auth = await context.getGitHubAuth();

  return {
    bot: context.callerBot,
    app_slug: context.botAuth.appSlug,
    repo: context.repo.fullName,
    token: auth.token,
    expires_at: auth.expiresAt,
    auth_mode: context.botAuth.provider,
  };
}
