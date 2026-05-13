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
  mockProjectStatusUpdateRequest,
} from '../../../../test/support/github/project.js';
import { withNock } from '../../../../test/support/http-test.js';
import { createRepoConfigWithDefaultProject } from '../../../../test/support/runtime-fixtures.js';

test('executeOrfeTool returns the shared success envelope for project set-status', async () => {
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
                  statusValue: createProjectStatusValueNode({ fieldId: 'PVTSSF_lAHOABCD1234', fieldName: 'Status', optionId: 'f75ad845', name: 'Todo' }),
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
            fields: createProjectFieldsConnection([
              {
                ...createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' }),
                options: [
                  { id: 'f75ad845', name: 'Todo' },
                  { id: 'f75ad846', name: 'In Progress' },
                ],
              },
            ]),
          },
        },
      },
    });
    const observedFieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([
              {
                ...createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' }),
                options: [
                  { id: 'f75ad845', name: 'Todo' },
                  { id: 'f75ad846', name: 'In Progress' },
                ],
              },
            ]),
          },
        },
      },
    });
    const mutationApi = mockProjectStatusUpdateRequest({
      projectId: 'PVT_project_1',
      itemId: 'PVTI_lAHOABCD1234',
      fieldId: 'PVTSSF_lAHOABCD1234',
      optionId: 'f75ad846',
    });
    const observedItemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      includeAuth: false,
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
                  statusValue: createProjectStatusValueNode({ fieldId: 'PVTSSF_lAHOABCD1234', fieldName: 'Status', optionId: 'f75ad846', name: 'In Progress' }),
                }),
              ]),
            },
          },
        },
      },
    });

    const result = await runToolCommand({
      input: { command: 'project set-status', item_type: 'issue', item_number: 13, status: 'In Progress' },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.equal(result.ok, true);
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
    assert.equal(mutationApi.isDone(), true);
    assert.equal(observedItemApi.isDone(), true);
    assert.equal(observedFieldsApi.isDone(), true);
  });
});
