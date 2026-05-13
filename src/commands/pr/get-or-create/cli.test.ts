import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockPullRequestGetOrCreateRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';

test('runCli prints structured success JSON for pr get-or-create when reusing a pull request', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      existingPullRequests: [
        {
          number: 9,
          title: 'Design the `orfe` custom tool and CLI contract',
          body: 'PR body',
          state: 'open',
          draft: false,
          head: { ref: 'issues/orfe-13' },
          base: { ref: 'main' },
          html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        },
      ],
    });

    const result = await invokeCli(['pr', 'get-or-create', '--head', 'issues/orfe-13', '--title', 'Design the `orfe` custom tool and CLI contract'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'pr get-or-create',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        head: 'issues/orfe-13',
        base: 'main',
        draft: false,
        created: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured success JSON for pr get-or-create when creating a pull request', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      existingPullRequests: [],
      createRequestBody: {
        head: 'issues/orfe-13',
        base: 'main',
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'Ref: #13',
        draft: true,
      },
      createResponseBody: {
        number: 10,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'Ref: #13',
        state: 'open',
        draft: true,
        head: { ref: 'issues/orfe-13' },
        base: { ref: 'main' },
        html_url: 'https://github.com/throw-if-null/orfe/pull/10',
      },
    });

    const result = await invokeCli(
      ['pr', 'get-or-create', '--head', 'issues/orfe-13', '--title', 'Design the `orfe` custom tool and CLI contract', '--body', 'Ref: #13', '--draft'],
      {
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'pr get-or-create',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 10,
        html_url: 'https://github.com/throw-if-null/orfe/pull/10',
        head: 'issues/orfe-13',
        base: 'main',
        draft: true,
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured template-validation failures for invalid PR bodies', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-59',
      existingPullRequests: [],
    });

    const result = await invokeCli(
      [
        'pr',
        'get-or-create',
        '--head',
        'issues/orfe-59',
        '--title',
        'Introduce versioned template support',
        '--body',
        'Ref: #59\n\nCloses: #59',
        '--template',
        'implementation-ready@1.0.0',
      ],
      {
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'pr get-or-create',
      error: {
        code: 'template_validation_failed',
        message: 'Template validation failed: body matched forbidden pattern (?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured auth failures for pr get-or-create lookup', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      listStatus: 403,
      listResponseBody: { message: 'Resource not accessible by integration' },
    });

    const result = await invokeCli(['pr', 'get-or-create', '--head', 'issues/orfe-13', '--title', 'Design the `orfe` custom tool and CLI contract'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'pr get-or-create',
      error: {
        code: 'auth_failed',
        message: 'GitHub App authentication failed while looking up pull requests for head "issues/orfe-13" and base "main".',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli reports missing required options for pr get-or-create as usage errors', async () => {
  const result = await invokeCli(['pr', 'get-or-create', '--head', 'issues/orfe-13'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Missing required option "--title"\./);
  assert.match(result.stderr, /Usage: orfe pr get-or-create --head <branch> --title <text>/);
  assert.match(result.stderr, /See: orfe pr get-or-create --help/);
});

test('runCli prints structured config failures for pr get-or-create', async () => {
  const result = await invokeCli(['pr', 'get-or-create', '--head', 'issues/orfe-13', '--title', 'Design the `orfe` custom tool and CLI contract'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: 'pr get-or-create',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});
