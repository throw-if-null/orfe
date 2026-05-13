import assert from 'node:assert/strict';

import { test } from 'vitest';

import { validateCommandInput } from '../../registry/index.js';
import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { prSubmitReviewCommand } from './definition.js';

test('pr submit-review definition keeps review submission inputs explicit', () => {
  assertDefinitionIdentity(prSubmitReviewCommand, {
    name: 'pr submit-review',
    group: 'pr',
    leaf: 'submit-review',
    execution: 'github',
  });
  assertOption(prSubmitReviewCommand, 'pr_number', { flag: '--pr-number', type: 'number', required: true });
  assertOption(prSubmitReviewCommand, 'event', { flag: '--event', type: 'string', required: true });
  assertOption(prSubmitReviewCommand, 'body', { flag: '--body', type: 'string', required: true });
  assertValidInputExample(prSubmitReviewCommand);
  assert.equal(prSubmitReviewCommand.successDataExample.submitted, true);
});

test('pr submit-review definition validation rejects unknown review events', () => {
  assert.throws(
    () => validateCommandInput(prSubmitReviewCommand, { pr_number: 9, event: 'merge', body: 'Looks good' }),
    /Review event must be one of: approve, request-changes, comment\./,
  );
});
