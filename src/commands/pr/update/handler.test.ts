import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { mockPullRequestUpdateRequest } from '../mocks/github.js';
import { renderPrBodyContractMarker } from '../../../../test/support/runtime-fixtures.js';

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

test('runOrfeCore validates PR bodies against explicit contracts and appends provenance on update', async () => {
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
        body: `${prBody}\n\n${renderPrBodyContractMarker()}`,
      },
      responseBody: {
        number: 9,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: `${prBody}\n\n${renderPrBodyContractMarker()}`,
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
        body_contract: 'implementation-ready@1.0.0',
      },
    });

    assert.equal(result.ok, true);
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore allows provenance-only pr-update validation when no explicit contract is provided', async () => {
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
      renderPrBodyContractMarker(),
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

test('runOrfeCore rejects invalid pr update body-contract combinations clearly', async () => {
  await assert.rejects(
    runCoreCommand({
      command: 'pr update',
      input: {
        pr_number: 9,
        body_contract: 'implementation-ready@1.0.0',
      },
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'invalid_usage');
      assert.equal(error.message, 'pr update only allows body_contract together with --body.');
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
          body_contract: 'implementation-ready@1.0.0',
        },
      }),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'contract_validation_failed');
        assert.equal(
          error.message,
          'Body contract validation failed: body matched forbidden pattern (?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+.',
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
