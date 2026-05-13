import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockPullRequestUpdateRequest } from '../mocks/github.js';
import { renderPrTemplateMarker } from '../../../../test/support/runtime-fixtures.js';

test('runOrfeCore updates pull request metadata and returns structured success output', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {
        title: 'Updated PR title',
        body: 'Updated PR body',
      },
    });

    const result = await runCoreCommand({
      command: 'pr update',
      input: {
        pr_number: 9,
        title: 'Updated PR title',
        body: 'Updated PR body',
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr update',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        title: 'Updated PR title',
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        head: 'issues/orfe-13',
        base: 'main',
        draft: false,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('executeOrfeTool returns the shared success envelope for pr update', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {
        title: 'Updated PR title',
      },
    });

    const result = await runToolCommand({
      input: {
        command: 'pr update',
        pr_number: 9,
        title: 'Updated PR title',
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr update',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        title: 'Updated PR title',
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        head: 'issues/orfe-13',
        base: 'main',
        draft: false,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore validates PR bodies against explicit templates and appends provenance on update', async () => {
  await withNock(async () => {
    const prBody = [
      'Ref: #142',
      '',
      '## Summary',
      '',
      '- add pr update command',
      '',
      '## Verification',
      '',
      '- `npm test` ✅',
      '- `npm run lint` ✅',
      '- `npm run typecheck` ✅',
      '- `npm run build` ✅',
      '',
      '## Docs / ADR / debt',
      '',
      '- docs updated: yes',
      '- ADR updated: no',
      '- debt updated: no',
      '- details: updated docs/orfe/spec.md',
      '',
      '## Risks / follow-ups',
      '',
      '- draft toggling remains out of scope for this slice',
    ].join('\n');

    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {
        body: `${prBody}\n\n${renderPrTemplateMarker()}`,
      },
      responseBody: {
        number: 9,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: `${prBody}\n\n${renderPrTemplateMarker()}`,
        state: 'open',
        draft: false,
        head: { ref: 'issues/orfe-13' },
        base: { ref: 'main' },
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
      },
    });

    const result = await runCoreCommand({
      command: 'pr update',
      input: {
        pr_number: 9,
        body: prBody,
        template: 'implementation-ready@1.0.0',
      },
    });

    assert.equal(result.ok, true);
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore allows provenance-only pr-update validation when no explicit template is provided', async () => {
  await withNock(async () => {
    const prBody = [
      'Ref: #142',
      '',
      '## Summary',
      '',
      '- keep body validation generic',
      '',
      '## Verification',
      '',
      '- `npm test` ✅',
      '- `npm run lint` ✅',
      '- `npm run typecheck` ✅',
      '- `npm run build` ✅',
      '',
      '## Docs / ADR / debt',
      '',
      '- docs updated: yes',
      '- ADR updated: no',
      '- debt updated: no',
      '- details: spec updated',
      '',
      '## Risks / follow-ups',
      '',
      '- none',
      '',
      renderPrTemplateMarker(),
    ].join('\n');

    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {
        body: prBody,
      },
    });

    const result = await runCoreCommand({
      command: 'pr update',
      input: {
        pr_number: 9,
        body: prBody,
      },
    });

    assert.equal(result.ok, true);
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore rejects invalid pr update template combinations clearly', async () => {
  await assert.rejects(
    runCoreCommand({
      command: 'pr update',
      input: {
        pr_number: 9,
        template: 'implementation-ready@1.0.0',
      },
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'invalid_usage');
      assert.equal(error.message, 'pr update only allows template together with --body.');
      return true;
    },
  );
});

test('runOrfeCore rejects pr update without mutation options clearly', async () => {
  await assert.rejects(
    runCoreCommand({
      command: 'pr update',
      input: {
        pr_number: 9,
      },
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'invalid_usage');
      assert.equal(error.message, 'pr update requires at least one mutation option.');
      return true;
    },
  );
});

test('runOrfeCore fails clearly when pr update body validation fails', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {},
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr update',
        input: {
          pr_number: 9,
          body: 'Ref: #142\n\nCloses: #142',
          template: 'implementation-ready@1.0.0',
        },
      }),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'template_validation_failed');
        assert.equal(
          error.message,
          'Template validation failed: body matched forbidden pattern (?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+.',
        );
        return true;
      },
    );

    assert.equal(api.isDone(), false);
  });
});

test('runOrfeCore maps pr update not-found responses clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 999,
      requestBody: { title: 'Updated PR title' },
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr update',
        input: { pr_number: 999, title: 'Updated PR title' },
      }),
      /Pull request #999 was not found\./,
    );

    assert.equal(api.isDone(), false);
  });
});

test('runCli prints structured success JSON for pr update', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {
        title: 'Updated PR title',
        body: 'Updated PR body',
      },
    });

    const result = await invokeCli(['pr', 'update', '--pr-number', '9', '--title', 'Updated PR title', '--body', 'Updated PR body'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'pr update',
      repo: 'throw-if-null/orfe',
      data: {
        pr_number: 9,
        title: 'Updated PR title',
        html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        head: 'issues/orfe-13',
        base: 'main',
        draft: false,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured template-validation failures for invalid pr update bodies', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: {},
    });

    const result = await invokeCli(
      ['pr', 'update', '--pr-number', '9', '--body', 'Ref: #142\n\nCloses: #142', '--template', 'implementation-ready@1.0.0'],
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
      command: 'pr update',
      error: {
        code: 'template_validation_failed',
        message: 'Template validation failed: body matched forbidden pattern (?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  });
});

test('runCli prints structured not-found failures for pr update', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 404,
      requestBody: { title: 'Updated PR title' },
      verifyStatus: 404,
      verifyResponseBody: { message: 'Not Found' },
    });

    const result = await invokeCli(['pr', 'update', '--pr-number', '404', '--title', 'Updated PR title'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'pr update',
      error: {
        code: 'github_not_found',
        message: 'Pull request #404 was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), false);
  });
});

test('runCli reports invalid option combinations for pr update as usage errors', async () => {
  const result = await invokeCli(['pr', 'update', '--pr-number', '9', '--template', 'implementation-ready@1.0.0'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /pr update only allows template together with --body\./);
  assert.match(result.stderr, /Usage: orfe pr update --pr-number <number> \[--title <text>] \[--body <text>] \[--template <name@version>] \[--repo <owner\/name>] \[--config <path>] \[--auth-config <path>]$/m);
  assert.match(result.stderr, /See: orfe pr update --help/);
});

test('runCli reports missing mutation options for pr update as usage errors', async () => {
  const result = await invokeCli(['pr', 'update', '--pr-number', '9'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('internal_error', 'loadRepoConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /pr update requires at least one mutation option\./);
  assert.match(result.stderr, /Usage: orfe pr update --pr-number <number> \[--title <text>] \[--body <text>] \[--template <name@version>] \[--repo <owner\/name>] \[--config <path>] \[--auth-config <path>]$/m);
  assert.match(result.stderr, /See: orfe pr update --help/);
});

test('runOrfeCore maps pr update auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestUpdateRequest({
      prNumber: 9,
      requestBody: { title: 'Updated PR title' },
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr update',
        input: { pr_number: 9, title: 'Updated PR title' },
      }),
      /GitHub App authentication failed while updating pull request #9\./,
    );

    assert.equal(api.isDone(), true);
  });
});
