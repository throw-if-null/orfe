import nock from 'nock';

export function mockAuthTokenMintRequest(options: {
  repo?: { owner: string; name: string };
  installationStatus?: number;
  tokenStatus?: number;
} = {}) {
  const owner = options.repo?.owner ?? 'throw-if-null';
  const repo = options.repo?.name ?? 'orfe';

  const scope = nock('https://api.github.com').get(`/repos/${owner}/${repo}/installation`).reply(options.installationStatus ?? 200, {
    id: 42,
  });

  if ((options.installationStatus ?? 200) === 200) {
    scope.post('/app/installations/42/access_tokens').reply(options.tokenStatus ?? 201, {
      token: 'ghs_123',
      expires_at: '2026-04-06T12:00:00Z',
    });
  }

  return scope;
}
