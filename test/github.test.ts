import assert from 'node:assert/strict';
import nock from 'nock';
import { test } from 'vitest';

import { GITHUB_API_VERSION, GitHubClientFactory } from '../src/github/client-factory.js';

// GITHUB_API_VERSION is defined in src/github/client-factory.ts and matches the GitHub REST API version date.
// See: https://docs.github.com/en/rest/about-the-rest-api/api-versions

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
    .reply(function (this: ReplyContext) {
      const apiVersion = this.req.headers['x-github-api-version'];

      assert.equal(apiVersion, GITHUB_API_VERSION);

      return [201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' }];
    })
    .get('/repos/throw-if-null/orfe/issues/14')
    .reply(function (this: ReplyContext) {
      const authorization = this.req.headers.authorization;
      const apiVersion = this.req.headers['x-github-api-version'];

      assert.match(String(authorization), /ghs_123/);
      assert.equal(apiVersion, GITHUB_API_VERSION);

      return [200, { number: 14, title: 'Build `orfe` foundation and runtime scaffolding' }];
    })
    .patch('/repos/throw-if-null/orfe/issues/14')
    .reply(function (this: ReplyContext) {
      const authorization = this.req.headers.authorization;
      const apiVersion = this.req.headers['x-github-api-version'];

      assert.match(String(authorization), /ghs_123/);
      assert.equal(apiVersion, GITHUB_API_VERSION);

      return [200, { number: 14, title: 'Build `orfe` foundation and runtime scaffolding', state: 'open' }];
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
  const issueUpdateResponse = await client.rest.issues.update({
    owner: 'throw-if-null',
    repo: 'orfe',
    issue_number: 14,
    title: 'Build `orfe` foundation and runtime scaffolding',
  });
  const graphqlResponse = await client.graphql<{ viewer: { login: string } }>('query { viewer { login } }');

  assert.equal(client.auth.installationId, 42);
  assert.equal(client.auth.token, 'ghs_123');
  assert.equal(issueResponse.data.title, 'Build `orfe` foundation and runtime scaffolding');
  assert.equal(issueUpdateResponse.data.state, 'open');
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

test('GitHubClientFactory can mint installation auth without constructing clients', async () => {
  nock.disableNetConnect();

  const api = nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' });

  const factory = new GitHubClientFactory({
    readFileImpl: async () => 'private-key',
    jwtFactory: () => 'jwt-token',
  });

  const auth = await factory.createInstallationAuth(
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

  assert.deepEqual(auth, {
    installationId: 42,
    token: 'ghs_123',
    expiresAt: '2026-04-06T12:00:00Z',
  });
  assert.equal(api.isDone(), true);
  nock.cleanAll();
  nock.enableNetConnect();
});
