import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';

test('executeOrfeTool returns structured PR validation output', async () => {
  await withNock(async () => {
    const result = await runToolCommand({
      input: {
        command: 'pr validate',
        body: 'Ref: #58\n\nCloses: #58',
        template: 'implementation-ready@1.0.0',
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'pr validate',
      repo: 'throw-if-null/orfe',
      data: {
        valid: false,
        template: {
          artifact_type: 'pr',
          template_name: 'implementation-ready',
          template_version: '1.0.0',
        },
        template_source: 'explicit',
        errors: [
          {
            kind: 'matched_forbidden_pattern',
            scope: 'body',
            pattern: '(?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+',
            message:
              'Template validation failed: body matched forbidden pattern (?:^|\\n)(?:Closes|Close|Closed|Fixes|Fix|Fixed|Resolves|Resolve|Resolved)\\s*:?\\s*#\\d+.',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Summary',
            message: 'Template validation failed: missing required section "Summary".',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Verification',
            message: 'Template validation failed: missing required section "Verification".',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Docs / ADR / debt',
            message: 'Template validation failed: missing required section "Docs / ADR / debt".',
          },
          {
            kind: 'missing_required_section',
            scope: 'section',
            section_heading: 'Risks / follow-ups',
            message: 'Template validation failed: missing required section "Risks / follow-ups".',
          },
        ],
      },
    });
  });
});
