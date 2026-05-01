import assert from 'node:assert/strict';
import { test } from 'vitest';

import { projectSetStatusCommand } from './definition.js';

test('project set-status slice owns its command metadata and contract examples', () => {
  assert.equal(projectSetStatusCommand.name, 'project set-status');
  assert.equal(projectSetStatusCommand.group, 'project');
  assert.equal(projectSetStatusCommand.leaf, 'set-status');
  assert.deepEqual(projectSetStatusCommand.validInputExample, { item_type: 'issue', item_number: 13, status: 'In Progress' });
  assert.deepEqual(projectSetStatusCommand.successDataExample, {
    project_owner: 'throw-if-null',
    project_number: 1,
    status_field_name: 'Status',
    status_field_id: 'PVTSSF_lAHOABCD1234',
    item_type: 'issue',
    item_number: 13,
    project_item_id: 'PVTI_lAHOABCD1234',
    status_option_id: 'f75ad846',
    status: 'In Progress',
    previous_status_option_id: 'f75ad845',
    previous_status: 'Todo',
    changed: true,
  });
});
