import assert from 'node:assert/strict';
import { test } from 'vitest';

import { projectGetStatusCommand } from './definition.js';

test('project get-status slice owns its command metadata and contract examples', () => {
  assert.equal(projectGetStatusCommand.name, 'project get-status');
  assert.equal(projectGetStatusCommand.group, 'project');
  assert.equal(projectGetStatusCommand.leaf, 'get-status');
  assert.deepEqual(projectGetStatusCommand.validInputExample, { item_type: 'issue', item_number: 13 });
  assert.deepEqual(projectGetStatusCommand.successDataExample, {
    project_owner: 'throw-if-null',
    project_number: 1,
    status_field_name: 'Status',
    status_field_id: 'PVTSSF_lAHOABCD1234',
    item_type: 'issue',
    item_number: 13,
    project_item_id: 'PVTI_lAHOABCD1234',
    status_option_id: 'f75ad846',
    status: 'In Progress',
  });
});
