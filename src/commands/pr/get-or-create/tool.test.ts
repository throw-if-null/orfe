import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import { mockPullRequestGetOrCreateRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';
import { renderPrTemplateMarker } from '../../../../test/support/runtime-fixtures.js';

test('executeOrfeTool returns the shared success envelope for pr get-or-create', async () => {
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

    const result = await runToolCommand({
      input: { command: 'pr get-or-create', head: 'issues/orfe-13', title: 'Design the `orfe` custom tool and CLI contract' },
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

test('executeOrfeTool validates PR bodies through templates before create', async () => {
  await withNock(async () => {
    const prBody = [
      'Ref: #59',
      '',
      '## Summary',
      '',
      '- add template support',
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
      '- richer generation is follow-up work',
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

    const result = await runToolCommand({
      input: {
        command: 'pr get-or-create',
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
