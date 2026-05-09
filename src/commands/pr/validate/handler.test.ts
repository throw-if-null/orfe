import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
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
        body_contract: 'implementation-ready@1.0.0',
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr validate',
      repo: 'throw-if-null/orfe',
      data: {
        valid: true,
        contract: {
          artifact_type: 'pr',
          contract_name: 'implementation-ready',
          contract_version: '1.0.0',
        },
        contract_source: 'explicit',
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
          '<!-- orfe-body-contract: pr/implementation-ready@1.0.0 -->',
        ].join('\n'),
        errors: [],
      },
    });
  });
});

test('executeOrfeTool returns structured PR validation output', async () => {
  await withNock(async () => {
    const result = await runToolCommand({
      input: {
        command: 'pr validate',
        body: 'Ref: #58\n\nCloses: #58',
        body_contract: 'implementation-ready@1.0.0',
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr validate',
      repo: 'throw-if-null/orfe',
      data: {
        valid: false,
        contract: {
          artifact_type: 'pr',
          contract_name: 'implementation-ready',
          contract_version: '1.0.0',
        },
        contract_source: 'explicit',
        errors: [
          {
            kind: 'matched_forbidden_pattern',
            scope: 'body',
            pattern: '(?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+',
            message:
              'Body contract validation failed: body matched forbidden pattern (?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+.',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Summary',
            message: 'Body contract validation failed: missing required section "Summary".',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Verification',
            message: 'Body contract validation failed: missing required section "Verification".',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Docs / ADR / debt',
            message: 'Body contract validation failed: missing required section "Docs / ADR / debt".',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Risks / follow-ups',
            message: 'Body contract validation failed: missing required section "Risks / follow-ups".',
          },
        ],
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
        body_contract: 'implementation-ready@1.0.0',
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

test('runOrfeCore fails clearly when contract validation fails', async () => {
  await withNock(async () => {
    const api = await import('../../../../test/support/pr-fixtures.js').then(({ mockPullRequestGetOrCreateRequest }) =>
      mockPullRequestGetOrCreateRequest({
        head: 'issues/orfe-59',
        existingPullRequests: [],
      }),
    );

    await assert.rejects(
      runCoreCommand({
        command: 'pr get-or-create',
        input: {
          head: 'issues/orfe-59',
          title: 'Introduce versioned body-contract support',
          body: 'Ref: #59\n\nCloses: #59',
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

    assert.equal(api.isDone(), true);
  });
});
