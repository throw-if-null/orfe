import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { runCoreCommand } from '../../../../test/support/command-runtime.js';
import { mockPullRequestGetOrCreateRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';
import { renderPrTemplateMarker } from '../../../../test/support/runtime-fixtures.js';

test('runOrfeCore reuses an existing pull request for pr get-or-create', async () => {
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

    const result = await runCoreCommand({
      command: 'pr get-or-create',
      input: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
    });

    assert.deepEqual(result, {
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

test('runOrfeCore reuses an existing pull request before validating unused template input', async () => {
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

    const result = await runCoreCommand({
      command: 'pr get-or-create',
      input: {
        head: 'issues/orfe-13',
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'Ref: #13\n\nCloses: #13',
        template: 'implementation-ready@1.0.0',
      },
    });

    assert.equal(result.ok, true);
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore creates a pull request for pr get-or-create when none exists', async () => {
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

    const result = await runCoreCommand({
      command: 'pr get-or-create',
      input: {
        head: 'issues/orfe-13',
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'Ref: #13',
        draft: true,
      },
    });

    assert.deepEqual(result, {
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

test('runOrfeCore validates PR bodies against explicit templates and appends provenance on create', async () => {
  await withNock(async () => {
    const prBody = [
      'Ref: #59',
      '',
      '## Summary',
      '',
      '- add versioned template support',
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
      '- ADR updated: yes',
      '- debt updated: yes',
      '- details: updated docs and added ADR',
      '',
      '## Risks / follow-ups',
      '',
      '- generation is still minimal in this slice',
    ].join('\n');

    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-59',
      existingPullRequests: [],
      createRequestBody: {
        head: 'issues/orfe-59',
        base: 'main',
        title: 'Introduce versioned template support',
        body: `${prBody}\n\n${renderPrTemplateMarker()}`,
        draft: false,
      },
      createResponseBody: {
        number: 59,
        title: 'Introduce versioned template support',
        body: `${prBody}\n\n${renderPrTemplateMarker()}`,
        state: 'open',
        draft: false,
        head: { ref: 'issues/orfe-59' },
        base: { ref: 'main' },
        html_url: 'https://github.com/throw-if-null/orfe/pull/59',
      },
    });

    const result = await runCoreCommand({
      command: 'pr get-or-create',
      input: {
        head: 'issues/orfe-59',
        title: 'Introduce versioned template support',
        body: prBody,
        template: 'implementation-ready@1.0.0',
      },
    });

    assert.equal(result.ok, true);
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore rejects ambiguous pr get-or-create matches clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      existingPullRequests: [
        {
          number: 9,
          title: 'First PR',
          body: 'PR body',
          state: 'open',
          draft: false,
          head: { ref: 'issues/orfe-13' },
          base: { ref: 'main' },
          html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        },
        {
          number: 10,
          title: 'Second PR',
          body: 'PR body',
          state: 'open',
          draft: true,
          head: { ref: 'issues/orfe-13' },
          base: { ref: 'main' },
          html_url: 'https://github.com/throw-if-null/orfe/pull/10',
        },
      ],
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr get-or-create',
        input: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
      }),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'github_conflict');
        assert.equal(
          error.message,
          'Found 2 open pull requests for head "issues/orfe-13" and base "main" in throw-if-null/orfe.',
        );
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps pr get-or-create lookup auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      listStatus: 403,
      listResponseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr get-or-create',
        input: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
      }),
      /GitHub App authentication failed while looking up pull requests for head "issues\/orfe-13" and base "main"\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps pr get-or-create creation auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      existingPullRequests: [],
      createStatus: 403,
      createResponseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr get-or-create',
        input: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
      }),
      /GitHub App authentication failed while creating a pull request for head "issues\/orfe-13" and base "main"\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore surfaces pr get-or-create creation failures clearly', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-13',
      existingPullRequests: [],
      createStatus: 422,
      createResponseBody: { message: 'Validation Failed' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr get-or-create',
        input: { head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
      }),
      /GitHub pull request creation failed with status 422: Validation Failed/,
    );

    assert.equal(api.isDone(), true);
  });
});
