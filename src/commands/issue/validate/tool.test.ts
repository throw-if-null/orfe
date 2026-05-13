import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';

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
