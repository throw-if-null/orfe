import assert from 'node:assert/strict';
import { test } from 'vitest';

import { issueSetStateCommand } from './definition.js';

test('issue set-state slice owns its command metadata and contract examples', () => {
  assert.equal(issueSetStateCommand.name, 'issue set-state');
  assert.equal(issueSetStateCommand.group, 'issue');
  assert.equal(issueSetStateCommand.leaf, 'set-state');
  assert.deepEqual(issueSetStateCommand.validInputExample, { issue_number: 13, state: 'closed', state_reason: 'completed' });
  assert.deepEqual(issueSetStateCommand.successDataExample, {
    issue_number: 13,
    state: 'closed',
    state_reason: 'completed',
    duplicate_of_issue_number: null,
    changed: true,
  });
});

test('issue set-state slice owns command-local validation', () => {
  assert.throws(
    () => issueSetStateCommand.validate?.({ issue_number: 14, state: 'open', state_reason: 'completed' }),
    /issue set-state only allows state_reason when --state closed is used\./,
  );
  assert.throws(
    () => issueSetStateCommand.validate?.({ issue_number: 14, state: 'closed', duplicate_of: 7 }),
    /issue set-state only allows duplicate_of with state_reason=duplicate\./,
  );
  assert.throws(
    () => issueSetStateCommand.validate?.({ issue_number: 14, state: 'closed', state_reason: 'duplicate' }),
    /issue set-state requires --duplicate-of when state_reason=duplicate\./,
  );
});
