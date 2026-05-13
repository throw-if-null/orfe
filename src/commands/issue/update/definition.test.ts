import assert from 'node:assert/strict';

import { test } from 'vitest';

import { validateCommandInput } from '../../registry/index.js';
import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { issueUpdateCommand } from './definition.js';

test('issue update definition keeps clear-* mutation flags and valid example wiring', () => {
  assertDefinitionIdentity(issueUpdateCommand, { name: 'issue update', group: 'issue', leaf: 'update', execution: 'github' });
  assertOption(issueUpdateCommand, 'clear_labels', { flag: '--clear-labels', type: 'boolean' });
  assertOption(issueUpdateCommand, 'clear_assignees', { flag: '--clear-assignees', type: 'boolean' });
  assertValidInputExample(issueUpdateCommand);
  assert.equal(issueUpdateCommand.successDataExample.changed, true);
});

test('issue update definition validation rejects missing or conflicting mutations', () => {
  assert.throws(() => validateCommandInput(issueUpdateCommand, { issue_number: 13 }), /issue update requires at least one mutation option\./);
  assert.throws(
    () => validateCommandInput(issueUpdateCommand, { issue_number: 13, labels: ['bug'], clear_labels: true }),
    /issue update does not allow labels together with --clear-labels\./,
  );
});
