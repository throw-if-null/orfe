import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';

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
    const api = await import('../mocks/github.js').then(({ mockPullRequestGetOrCreateRequest }) =>
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

test('runCli prints structured success JSON for pr validate', async () => {
  const result = await invokeCli(
    [
      'pr',
      'validate',
      '--body',
      'Ref: #58\n\n## Summary\n- add PR body validation\n\n## Verification\n- `npm test` ✅\n- `npm run lint` ✅\n- `npm run typecheck` ✅\n- `npm run build` ✅\n\n## Docs / ADR / debt\n- docs updated: yes\n- ADR updated: no\n- debt updated: no\n- details: updated docs/orfe/spec.md\n\n## Risks / follow-ups\n- none',
      '--template',
      'implementation-ready@1.0.0',
    ],
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
      normalized_body:
        'Ref: #58\n\n## Summary\n- add PR body validation\n\n## Verification\n- `npm test` ✅\n- `npm run lint` ✅\n- `npm run typecheck` ✅\n- `npm run build` ✅\n\n## Docs / ADR / debt\n- docs updated: yes\n- ADR updated: no\n- debt updated: no\n- details: updated docs/orfe/spec.md\n\n## Risks / follow-ups\n- none\n\n<!-- orfe-template: pr/implementation-ready@1.0.0 -->',
      errors: [],
    },
  });
});

test('runCli prints structured PR validation failures for pr validate', async () => {
  const result = await invokeCli(['pr', 'validate', '--body', 'Ref: #58\n\nCloses: #58', '--template', 'implementation-ready@1.0.0'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    ...createRuntimeDependencies(),
    githubClientFactory: createGitHubClientFactory(),
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).data.valid, false);
  assert.deepEqual(
    JSON.parse(result.stdout).data.errors.map((issue: { kind: string }) => issue.kind),
    ['matched_forbidden_pattern', 'missing_required_section', 'missing_required_section', 'missing_required_section', 'missing_required_section'],
  );
});
