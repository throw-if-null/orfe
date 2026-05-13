import assert from 'node:assert/strict';

import { test } from 'vitest';

import { validateCommandInput } from '../../registry/index.js';
import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { issueSetStateCommand } from './definition.js';

test('issue set-state definition keeps state enums and duplicate metadata in the contract', () => {
  assertDefinitionIdentity(issueSetStateCommand, { name: 'issue set-state', group: 'issue', leaf: 'set-state', execution: 'github' });
  assertOption(issueSetStateCommand, 'state', {
    flag: '--state',
    type: 'enum',
    required: true,
    enumValues: ['open', 'closed'],
  });
  assertOption(issueSetStateCommand, 'state_reason', {
    flag: '--state-reason',
    type: 'enum',
    enumValues: ['completed', 'not_planned', 'duplicate'],
  });
  assertValidInputExample(issueSetStateCommand);
  assert.equal(issueSetStateCommand.successDataExample.changed, true);
});

test('issue set-state definition validation enforces duplicate-specific rules', () => {
  assert.throws(
    () => validateCommandInput(issueSetStateCommand, { issue_number: 13, state: 'open', state_reason: 'completed' }),
    /issue set-state only allows state_reason when --state closed is used\./,
  );
  assert.throws(
    () => validateCommandInput(issueSetStateCommand, { issue_number: 13, state: 'closed', state_reason: 'duplicate' }),
    /issue set-state requires --duplicate-of when state_reason=duplicate\./,
  );
});
