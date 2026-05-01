import assert from 'node:assert/strict';
import { test } from 'vitest';

import { issueValidateCommand } from './definition.js';

test('issue validate slice owns its command metadata and contract examples', () => {
  assert.equal(issueValidateCommand.name, 'issue validate');
  assert.equal(issueValidateCommand.group, 'issue');
  assert.equal(issueValidateCommand.leaf, 'validate');
  assert.deepEqual(issueValidateCommand.validInputExample, {
    body: '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned contract.\n\n## Scope\n\n### In scope\n- declarative contracts\n\n### Out of scope\n- executable plugins\n\n## Acceptance criteria\n\n- [ ] contracts load from .orfe/contracts\n\n## Docs impact\n\n- Docs impact: update existing docs\n- Details: update docs/orfe/spec.md\n\n## ADR needed?\n\n- ADR needed: no\n- Details: covered by ADR 0009\n\n## Dependencies / sequencing notes\n\n- depends on #59\n\n## Risks / open questions / non-goals\n\n- keep repo-specific structure out of runtime logic',
    body_contract: 'formal-work-item@1.0.0',
  });
  assert.deepEqual(issueValidateCommand.successDataExample, {
    valid: true,
    contract: {
      artifact_type: 'issue',
      contract_name: 'formal-work-item',
      contract_version: '1.0.0',
    },
    contract_source: 'explicit',
    normalized_body:
      '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned contract.\n\n## Scope\n\n### In scope\n- declarative contracts\n\n### Out of scope\n- executable plugins\n\n## Acceptance criteria\n\n- [ ] contracts load from .orfe/contracts\n\n## Docs impact\n\n- Docs impact: update existing docs\n- Details: update docs/orfe/spec.md\n\n## ADR needed?\n\n- ADR needed: no\n- Details: covered by ADR 0009\n\n## Dependencies / sequencing notes\n\n- depends on #59\n\n## Risks / open questions / non-goals\n\n- keep repo-specific structure out of runtime logic\n\n<!-- orfe-body-contract: issue/formal-work-item@1.0.0 -->',
    errors: [],
  });
});
