import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { runCoreCommand } from '../../../../test/support/command-runtime.js';
import { mockPullRequestGetOrCreateRequest } from '../../../../test/support/github/pr.js';
import { withNock } from '../../../../test/support/http-test.js';

test('runOrfeCore returns structured PR validation results without GitHub access', async () => {
  await withNock(async () => {
    const result = await runCoreCommand({
      command: 'pr validate',
      input: {
        body: [
          'Ref: #58',
          '',
          '## Summary',
          '',
          '- add PR body validation helpers',
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
          '- none',
        ].join('\n'),
        template: 'implementation-ready@1.0.0',
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr validate',
      repo: 'throw-if-null/orfe',
      data: {
        valid: true,
        template: {
          artifact_type: 'pr',
          template_name: 'implementation-ready',
          template_version: '1.0.0',
        },
        template_source: 'explicit',
        normalized_body: [
          'Ref: #58',
          '',
          '## Summary',
          '',
          '- add PR body validation helpers',
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
          '- none',
          '',
          '<!-- orfe-template: pr/implementation-ready@1.0.0 -->',
        ].join('\n'),
        errors: [],
      },
    });
  });
});

test('runOrfeCore returns actionable PR validation failures', async () => {
  await withNock(async () => {
    const result = await runCoreCommand({
      command: 'pr validate',
      input: {
        body: 'Ref: #58\n\nCloses: #58',
        template: 'implementation-ready@1.0.0',
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.command, 'pr validate');
    assert.equal(result.repo, 'throw-if-null/orfe');
    assert.equal((result.data as { valid: boolean }).valid, false);
    assert.deepEqual(
      (result.data as { errors: Array<{ kind: string }> }).errors.map((issue) => issue.kind),
      ['matched_forbidden_pattern', 'missing_required_section', 'missing_required_section', 'missing_required_section', 'missing_required_section'],
    );
  });
});

test('runOrfeCore fails clearly when template validation fails', async () => {
  await withNock(async () => {
    const api = mockPullRequestGetOrCreateRequest({
      head: 'issues/orfe-59',
      existingPullRequests: [],
    });

    await assert.rejects(
      runCoreCommand({
        command: 'pr get-or-create',
        input: {
          head: 'issues/orfe-59',
          title: 'Introduce versioned template support',
          body: 'Ref: #59\n\nCloses: #59',
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

    assert.equal(api.isDone(), true);
  });
});
