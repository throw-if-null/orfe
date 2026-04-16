import assert from 'node:assert/strict';
import test from 'node:test';

import { prGetCommand } from './definition.js';

test('pr get slice owns its command metadata and contract examples', () => {
  assert.equal(prGetCommand.name, 'pr get');
  assert.equal(prGetCommand.group, 'pr');
  assert.equal(prGetCommand.leaf, 'get');
  assert.deepEqual(prGetCommand.validInputExample, { pr_number: 9 });
  assert.deepEqual(prGetCommand.successDataExample, {
    pr_number: 9,
    title: 'Design the `orfe` custom tool and CLI contract',
    body: '...',
    state: 'open',
    draft: false,
    head: 'issues/orfe-13',
    base: 'main',
    html_url: 'https://github.com/throw-if-null/orfe/pull/9',
  });
});
