import assert from 'node:assert/strict';

import { test } from 'vitest';

import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';

test('runCli prints structured success JSON for issue validate', async () => {
  const result = await invokeCli(
    [
      'issue',
      'validate',
      '--body',
      '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned template.\n\n## Scope\n\n### In scope\n- declarative templates\n\n### Out of scope\n- executable plugins\n\n## Acceptance criteria\n\n- [ ] templates load from .orfe/templates\n\n## Docs impact\n\n- Docs impact: update existing docs\n- Details: update docs/orfe/spec.md\n\n## ADR needed?\n\n- ADR needed: no\n- Details: covered by ADR 0009\n\n## Dependencies / sequencing notes\n\n- depends on #59\n\n## Risks / open questions / non-goals\n\n- keep repo-specific structure out of runtime logic',
      '--template',
      'formal-work-item@1.0.0',
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
    command: 'issue validate',
    repo: 'throw-if-null/orfe',
    data: {
      valid: true,
      template: {
        artifact_type: 'issue',
        template_name: 'formal-work-item',
        template_version: '1.0.0',
      },
      template_source: 'explicit',
      normalized_body:
        '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned template.\n\n## Scope\n\n### In scope\n- declarative templates\n\n### Out of scope\n- executable plugins\n\n## Acceptance criteria\n\n- [ ] templates load from .orfe/templates\n\n## Docs impact\n\n- Docs impact: update existing docs\n- Details: update docs/orfe/spec.md\n\n## ADR needed?\n\n- ADR needed: no\n- Details: covered by ADR 0009\n\n## Dependencies / sequencing notes\n\n- depends on #59\n\n## Risks / open questions / non-goals\n\n- keep repo-specific structure out of runtime logic\n\n<!-- orfe-template: issue/formal-work-item@1.0.0 -->',
      errors: [],
    },
  });
});

test('runCli prints structured issue validation failures for issue validate', async () => {
  const result = await invokeCli(
    [
      'issue',
      'validate',
      '--body',
      '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned template.\n\n## Scope\n\n### In scope\n- declarative templates\n\n## Docs impact\n\n- Docs impact: maybe\n\n## ADR needed?\n\n- ADR needed: no',
      '--template',
      'formal-work-item@1.0.0',
    ],
    {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).data.valid, false);
  assert.deepEqual(
    JSON.parse(result.stdout).data.errors.map((issue: { kind: string }) => issue.kind),
    ['missing_required_pattern', 'missing_required_section', 'invalid_allowed_value'],
  );
});
