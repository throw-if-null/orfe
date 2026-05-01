import assert from 'node:assert/strict';
import { test } from 'vitest';

import { issueUpdateCommand } from './definition.js';

test('issue update slice owns its command metadata and contract examples', () => {
  assert.equal(issueUpdateCommand.name, 'issue update');
  assert.equal(issueUpdateCommand.group, 'issue');
  assert.equal(issueUpdateCommand.leaf, 'update');
  assert.deepEqual(issueUpdateCommand.validInputExample, { issue_number: 13, title: 'Updated title' });
  assert.deepEqual(issueUpdateCommand.successDataExample, {
    issue_number: 13,
    title: 'Updated title',
    state: 'open',
    html_url: 'https://github.com/throw-if-null/orfe/issues/13',
    changed: true,
  });
});

test('issue update slice owns command-local validation', () => {
  assert.throws(() => issueUpdateCommand.validate?.({ issue_number: 14 }), /issue update requires at least one mutation option\./);
  assert.throws(
    () => issueUpdateCommand.validate?.({ issue_number: 14, labels: ['bug'], clear_labels: true }),
    /issue update does not allow labels together with --clear-labels\./,
  );
});
