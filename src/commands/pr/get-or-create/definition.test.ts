import assert from 'node:assert/strict';
import test from 'node:test';

import { prGetOrCreateCommand } from './definition.js';

test('pr get-or-create slice owns its command metadata and contract examples', () => {
  assert.equal(prGetOrCreateCommand.name, 'pr get-or-create');
  assert.equal(prGetOrCreateCommand.group, 'pr');
  assert.equal(prGetOrCreateCommand.leaf, 'get-or-create');
  assert.deepEqual(prGetOrCreateCommand.validInputExample, {
    head: 'issues/orfe-13',
    title: 'Design the `orfe` custom tool and CLI contract',
  });
  assert.deepEqual(prGetOrCreateCommand.successDataExample, {
    pr_number: 9,
    html_url: 'https://github.com/throw-if-null/orfe/pull/9',
    head: 'issues/orfe-13',
    base: 'main',
    draft: false,
    created: false,
  });
});
