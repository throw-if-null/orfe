import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { projectSetStatusCommand } from './definition.js';

test('project set-status definition keeps target item and status mutation inputs explicit', () => {
  assertDefinitionIdentity(projectSetStatusCommand, {
    name: 'project set-status',
    group: 'project',
    leaf: 'set-status',
    execution: 'github',
  });
  assertOption(projectSetStatusCommand, 'item_type', {
    flag: '--item-type',
    type: 'enum',
    required: true,
    enumValues: ['issue', 'pr'],
  });
  assertOption(projectSetStatusCommand, 'status', { flag: '--status', type: 'string', required: true });
  assertValidInputExample(projectSetStatusCommand);
  assert.equal(projectSetStatusCommand.successDataExample.previous_status, 'Todo');
});
