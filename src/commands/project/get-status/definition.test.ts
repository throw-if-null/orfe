import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { projectGetStatusCommand } from './definition.js';

test('project get-status definition keeps item-type enums and project overrides explicit', () => {
  assertDefinitionIdentity(projectGetStatusCommand, {
    name: 'project get-status',
    group: 'project',
    leaf: 'get-status',
    execution: 'github',
  });
  assertOption(projectGetStatusCommand, 'item_type', {
    flag: '--item-type',
    type: 'enum',
    required: true,
    enumValues: ['issue', 'pr'],
  });
  assertOption(projectGetStatusCommand, 'item_number', { flag: '--item-number', type: 'number', required: true });
  assertValidInputExample(projectGetStatusCommand);
  assert.equal(projectGetStatusCommand.successDataExample.status, 'In Progress');
});
