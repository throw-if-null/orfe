import assert from 'node:assert/strict';
import nock from 'nock';
import test from 'node:test';

import { GitHubClientFactory } from '../src/github.js';

interface ReplyContext {
  req: {
    headers: Record<string, string | string[] | undefined>;
  };
}

test('GitHubClientFactory mints an installation token and returns Octokit REST and GraphQL clients', async () => {
  nock.disableNetConnect();

  const api = nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get('/repos/throw-if-null/orfe/issues/14')
    .reply(function (this: ReplyContext) {
      const authorization = this.req.headers.authorization;
      assert.match(String(authorization), /ghs_123/);

      return [200, { number: 14, title: 'Build `orfe` foundation and runtime scaffolding' }];
    })
    .post('/graphql')
    .reply(function (this: ReplyContext) {
      const authorization = this.req.headers.authorization;
      assert.match(String(authorization), /ghs_123/);

      return [200, { data: { viewer: { login: 'GR3G-BOT' } } }];
    });

  const factory = new GitHubClientFactory({
    readFileImpl: async () => 'private-key',
    jwtFactory: () => 'jwt-token',
  });

  const client = await factory.createClient(
    'greg',
    {
      provider: 'github-app',
      appId: 123458,
      appSlug: 'GR3G-BOT',
      privateKeyPath: '/tmp/greg.pem',
    },
    {
      owner: 'throw-if-null',
      name: 'orfe',
      fullName: 'throw-if-null/orfe',
    },
  );

  const issueResponse = await client.rest.issues.get({ owner: 'throw-if-null', repo: 'orfe', issue_number: 14 });
  const graphqlResponse = await client.graphql<{ viewer: { login: string } }>('query { viewer { login } }');

  assert.equal(client.auth.installationId, 42);
  assert.equal(client.auth.token, 'ghs_123');
  assert.equal(issueResponse.data.title, 'Build `orfe` foundation and runtime scaffolding');
  assert.equal(graphqlResponse.viewer.login, 'GR3G-BOT');
  assert.equal(api.isDone(), true);

  nock.cleanAll();
  nock.enableNetConnect();
});

test('GitHubClientFactory reports missing installations clearly', async () => {
  nock.disableNetConnect();

  const api = nock('https://api.github.com').get('/repos/throw-if-null/orfe/installation').reply(404, { message: 'Not Found' });

  const factory = new GitHubClientFactory({
    readFileImpl: async () => 'private-key',
    jwtFactory: () => 'jwt-token',
  });

  await assert.rejects(
    factory.createClient(
      'greg',
      {
        provider: 'github-app',
        appId: 123458,
        appSlug: 'GR3G-BOT',
        privateKeyPath: '/tmp/greg.pem',
      },
      {
        owner: 'throw-if-null',
        name: 'orfe',
        fullName: 'throw-if-null/orfe',
      },
    ),
    /No GitHub App installation for throw-if-null\/orfe was found/,
  );

  assert.equal(api.isDone(), true);
  nock.cleanAll();
  nock.enableNetConnect();
});
