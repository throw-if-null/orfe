import assert from 'node:assert/strict';
import { test } from 'vitest';

import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';

test('runOrfeCore can validate issue bodies without auth config or GitHub access', async () => {
  const result = await runCoreCommand({
    command: 'issue validate',
    input: {
      body: [
        '## Problem / context',
        '',
        'Need deterministic issue-body validation.',
        '',
        '## Desired outcome',
        '',
        'Issue bodies validate against a versioned template.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative templates',
        '',
        '### Out of scope',
        '- executable plugins',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] templates load from .orfe/templates',
        '',
        '## Docs impact',
        '',
        '- Docs impact: update existing docs',
        '- Details: update docs/orfe/spec.md',
        '',
        '## ADR needed?',
        '',
        '- ADR needed: no',
        '- Details: covered by ADR 0009',
        '',
        '## Dependencies / sequencing notes',
        '',
        '- depends on #59',
        '',
        '## Risks / open questions / non-goals',
        '',
        '- keep repo-specific structure out of runtime logic',
      ].join('\n'),
      template: 'formal-work-item@1.0.0',
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, 'issue validate');
  assert.equal(result.repo, 'throw-if-null/orfe');
  if (result.ok) {
    assert.equal((result.data as { valid: boolean }).valid, true);
  }
});

test('runOrfeCore returns structured issue validation results', async () => {
  const result = await runCoreCommand({
    command: 'issue validate',
    input: {
      body: [
        '## Problem / context',
        '',
        'Need deterministic issue-body validation.',
        '',
        '## Desired outcome',
        '',
        'Issue bodies validate against a versioned template.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative templates',
        '',
        '### Out of scope',
        '- executable plugins',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] templates load from .orfe/templates',
        '',
        '## Docs impact',
        '',
        '- Docs impact: update existing docs',
        '- Details: update docs/orfe/spec.md',
        '',
        '## ADR needed?',
        '',
        '- ADR needed: no',
        '- Details: covered by ADR 0009',
        '',
        '## Dependencies / sequencing notes',
        '',
        '- depends on #59',
        '',
        '## Risks / open questions / non-goals',
        '',
        '- keep repo-specific structure out of runtime logic',
      ].join('\n'),
      template: 'formal-work-item@1.0.0',
    },
  });

  assert.deepEqual(result, {
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
      normalized_body: [
        '## Problem / context',
        '',
        'Need deterministic issue-body validation.',
        '',
        '## Desired outcome',
        '',
        'Issue bodies validate against a versioned template.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative templates',
        '',
        '### Out of scope',
        '- executable plugins',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] templates load from .orfe/templates',
        '',
        '## Docs impact',
        '',
        '- Docs impact: update existing docs',
        '- Details: update docs/orfe/spec.md',
        '',
        '## ADR needed?',
        '',
        '- ADR needed: no',
        '- Details: covered by ADR 0009',
        '',
        '## Dependencies / sequencing notes',
        '',
        '- depends on #59',
        '',
        '## Risks / open questions / non-goals',
        '',
        '- keep repo-specific structure out of runtime logic',
        '',
        '<!-- orfe-template: issue/formal-work-item@1.0.0 -->',
      ].join('\n'),
      errors: [],
    },
  });
});

test('runOrfeCore returns structured issue validation results without GitHub access', async () => {
  const result = await runCoreCommand({
    command: 'issue validate',
    input: {
      body: [
        '## Problem / context',
        '',
        'Need deterministic issue-body validation.',
        '',
        '## Desired outcome',
        '',
        'Issue bodies validate against a versioned template.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative templates',
        '',
        '### Out of scope',
        '- executable plugins',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] templates load from .orfe/templates',
        '',
        '## Docs impact',
        '',
        '- Docs impact: update existing docs',
        '- Details: update docs/orfe/spec.md',
        '',
        '## ADR needed?',
        '',
        '- ADR needed: no',
        '- Details: covered by ADR 0009',
        '',
        '## Dependencies / sequencing notes',
        '',
        '- depends on #59',
        '',
        '## Risks / open questions / non-goals',
        '',
        '- keep repo-specific structure out of runtime logic',
      ].join('\n'),
      template: 'formal-work-item@1.0.0',
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal((result.data as { valid: boolean }).valid, true);
  }
});

test('executeOrfeTool returns structured issue validation output', async () => {
  const result = await runToolCommand({
    input: {
      command: 'issue validate',
      body: [
        '## Problem / context',
        '',
        'Need deterministic issue-body validation.',
        '',
        '## Desired outcome',
        '',
        'Issue bodies validate against a versioned template.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative templates',
        '',
        '### Out of scope',
        '- executable plugins',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] templates load from .orfe/templates',
        '',
        '## Docs impact',
        '',
        '- Docs impact: update existing docs',
        '- Details: update docs/orfe/spec.md',
        '',
        '## ADR needed?',
        '',
        '- ADR needed: no',
        '- Details: covered by ADR 0009',
        '',
        '## Dependencies / sequencing notes',
        '',
        '- depends on #59',
        '',
        '## Risks / open questions / non-goals',
        '',
        '- keep repo-specific structure out of runtime logic',
      ].join('\n'),
      template: 'formal-work-item@1.0.0',
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.command, 'issue validate');
    assert.equal((result.data as { valid: boolean }).valid, true);
  }
});

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

test('runOrfeCore returns actionable issue validation failures', async () => {
  const result = await runCoreCommand({
    command: 'issue validate',
    input: {
      body: [
        '## Problem / context',
        '',
        'Need deterministic issue-body validation.',
        '',
        '## Desired outcome',
        '',
        'Issue bodies validate against a versioned template.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative templates',
        '',
        '## Docs impact',
        '',
        '- Docs impact: maybe',
        '',
        '## ADR needed?',
        '',
        '- ADR needed: no',
      ].join('\n'),
      template: 'formal-work-item@1.0.0',
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, 'issue validate');
  assert.equal(result.repo, 'throw-if-null/orfe');
  assert.equal((result.data as { valid: boolean }).valid, false);
  assert.deepEqual(
    (result.data as { errors: Array<{ kind: string }> }).errors.map((issue) => issue.kind),
    ['missing_required_pattern', 'missing_required_section', 'invalid_allowed_value'],
  );
});
