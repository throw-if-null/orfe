import assert from 'node:assert/strict';
import { test } from 'vitest';

import { issueCreateCommand } from './definition.js';

test('issue create slice owns its command metadata and contract examples', () => {
  assert.equal(issueCreateCommand.name, 'issue create');
  assert.equal(issueCreateCommand.group, 'issue');
  assert.equal(issueCreateCommand.leaf, 'create');
  assert.deepEqual(issueCreateCommand.validInputExample, { title: 'New issue title' });
  assert.match(issueCreateCommand.usage, /--add-to-project/);
  assert.match(issueCreateCommand.usage, /--status <value>/);
  assert.deepEqual(issueCreateCommand.successDataExample, {
    issue_number: 21,
    title: 'New issue title',
    state: 'open',
    html_url: 'https://github.com/throw-if-null/orfe/issues/21',
    created: true,
  });
});
