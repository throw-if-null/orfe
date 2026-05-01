import assert from 'node:assert/strict';
import { test } from 'vitest';

import { issueGetCommand } from './definition.js';

test('issue get slice owns its command metadata and contract examples', () => {
  assert.equal(issueGetCommand.name, 'issue get');
  assert.equal(issueGetCommand.group, 'issue');
  assert.equal(issueGetCommand.leaf, 'get');
  assert.deepEqual(issueGetCommand.validInputExample, { issue_number: 13 });
  assert.deepEqual(issueGetCommand.successDataExample, {
    issue_number: 13,
    title: 'Design the `orfe` custom tool and CLI contract',
    body: '...',
    state: 'open',
    state_reason: null,
    labels: ['needs-input'],
    assignees: ['greg'],
    html_url: 'https://github.com/throw-if-null/orfe/issues/13',
  });
});
