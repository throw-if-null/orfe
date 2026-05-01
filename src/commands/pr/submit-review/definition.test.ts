import assert from 'node:assert/strict';
import { test } from 'vitest';

import { prSubmitReviewCommand } from './definition.js';

test('pr submit-review slice owns its command metadata and contract examples', () => {
  assert.equal(prSubmitReviewCommand.name, 'pr submit-review');
  assert.equal(prSubmitReviewCommand.group, 'pr');
  assert.equal(prSubmitReviewCommand.leaf, 'submit-review');
  assert.deepEqual(prSubmitReviewCommand.validInputExample, { pr_number: 9, event: 'approve', body: 'Looks good' });
  assert.deepEqual(prSubmitReviewCommand.successDataExample, {
    pr_number: 9,
    review_id: 555,
    event: 'approve',
    submitted: true,
  });
});

test('pr submit-review slice owns command-local validation', () => {
  assert.throws(
    () => prSubmitReviewCommand.validate?.({ pr_number: 9, event: 'dismiss', body: 'Nope' }),
    /Review event must be one of: approve, request-changes, comment\./,
  );
});
