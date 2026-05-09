import assert from 'node:assert/strict';
import { test } from 'vitest';

import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';

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
        'Issue bodies validate against a versioned contract.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative contracts',
        '',
        '### Out of scope',
        '- executable plugins',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] contracts load from .orfe/contracts',
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
      body_contract: 'formal-work-item@1.0.0',
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
        'Issue bodies validate against a versioned contract.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative contracts',
        '',
        '### Out of scope',
        '- executable plugins',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] contracts load from .orfe/contracts',
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
      body_contract: 'formal-work-item@1.0.0',
    },
  });

  assert.deepEqual(result, {
    ok: true,
    command: 'issue validate',
    repo: 'throw-if-null/orfe',
    data: {
      valid: true,
      contract: {
        artifact_type: 'issue',
        contract_name: 'formal-work-item',
        contract_version: '1.0.0',
      },
      contract_source: 'explicit',
      normalized_body: [
        '## Problem / context',
        '',
        'Need deterministic issue-body validation.',
        '',
        '## Desired outcome',
        '',
        'Issue bodies validate against a versioned contract.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative contracts',
        '',
        '### Out of scope',
        '- executable plugins',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] contracts load from .orfe/contracts',
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
        '<!-- orfe-body-contract: issue/formal-work-item@1.0.0 -->',
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
        'Issue bodies validate against a versioned contract.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative contracts',
        '',
        '### Out of scope',
        '- executable plugins',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] contracts load from .orfe/contracts',
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
      body_contract: 'formal-work-item@1.0.0',
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
        'Issue bodies validate against a versioned contract.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative contracts',
        '',
        '### Out of scope',
        '- executable plugins',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] contracts load from .orfe/contracts',
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
      body_contract: 'formal-work-item@1.0.0',
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.command, 'issue validate');
    assert.equal((result.data as { valid: boolean }).valid, true);
  }
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
        'Issue bodies validate against a versioned contract.',
        '',
        '## Scope',
        '',
        '### In scope',
        '- declarative contracts',
        '',
        '## Docs impact',
        '',
        '- Docs impact: maybe',
        '',
        '## ADR needed?',
        '',
        '- ADR needed: no',
      ].join('\n'),
      body_contract: 'formal-work-item@1.0.0',
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
