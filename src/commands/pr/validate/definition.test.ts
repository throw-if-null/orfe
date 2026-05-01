import assert from 'node:assert/strict';
import { test } from 'vitest';

import { prValidateCommand } from './definition.js';

test('pr validate slice owns its command metadata and contract examples', () => {
  assert.equal(prValidateCommand.name, 'pr validate');
  assert.equal(prValidateCommand.group, 'pr');
  assert.equal(prValidateCommand.leaf, 'validate');
  assert.deepEqual(prValidateCommand.validInputExample, {
    body: 'Ref: #58\n\n## Summary\n- add PR validation\n\n## Verification\n- `npm test` ✅\n- `npm run lint` ✅\n- `npm run typecheck` ✅\n- `npm run build` ✅\n\n## Docs / ADR / debt\n- docs updated: yes\n- ADR updated: no\n- debt updated: no\n- details: updated the spec\n\n## Risks / follow-ups\n- none',
    body_contract: 'implementation-ready@1.0.0',
  });
  assert.deepEqual(prValidateCommand.successDataExample, {
    valid: true,
    contract: {
      artifact_type: 'pr',
      contract_name: 'implementation-ready',
      contract_version: '1.0.0',
    },
    contract_source: 'explicit',
    normalized_body:
      'Ref: #58\n\n## Summary\n- add PR validation\n\n## Verification\n- `npm test` ✅\n- `npm run lint` ✅\n- `npm run typecheck` ✅\n- `npm run build` ✅\n\n## Docs / ADR / debt\n- docs updated: yes\n- ADR updated: no\n- debt updated: no\n- details: updated the spec\n\n## Risks / follow-ups\n- none\n\n<!-- orfe-body-contract: pr/implementation-ready@1.0.0 -->',
    errors: [],
  });
});
