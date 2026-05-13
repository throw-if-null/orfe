import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import {
  createProjectFieldsConnection,
  createProjectItemNode,
  createProjectItemsConnection,
  createProjectStatusFieldNode,
  createProjectStatusValueNode,
  mockProjectGetStatusRequest,
  mockProjectStatusFieldsRequest,
} from '../../../../test/support/github/project.js';
import { withNock } from '../../../../test/support/http-test.js';
import { createRepoConfigWithDefaultProject } from '../../../../test/support/runtime-fixtures.js';

test('executeOrfeTool returns the shared success envelope for project get-status', async () => {
  await withNock(async () => {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({
                  id: 'PVTI_lAHOABCD1234',
                  projectId: 'PVT_project_1',
                  projectOwner: 'throw-if-null',
                  projectNumber: 1,
                  statusValue: createProjectStatusValueNode({
                    fieldId: 'PVTSSF_lAHOABCD1234',
                    fieldName: 'Status',
                    optionId: 'f75ad846',
                    name: 'In Progress',
                  }),
                }),
              ]),
            },
          },
        },
      },
    });
    const fieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' })]),
          },
        },
      },
    });

    const result = await runToolCommand({
      input: { command: 'project get-status', item_type: 'issue', item_number: 13 },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.equal(result.ok, true);
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  });
});
