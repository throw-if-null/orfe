import assert from 'node:assert/strict';
import { test } from 'vitest';

import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import {
  createProjectFieldsConnection,
  createProjectItemNode,
  createProjectItemsConnection,
  createProjectStatusFieldNode,
  createProjectStatusValueNode,
  mockProjectGetStatusRequest,
  mockProjectStatusFieldsRequest,
  mockProjectStatusUpdateRequest,
} from '../../../../test/project/fixtures.js';
import { createRepoConfigWithDefaultProject } from '../../../../test/support/runtime-fixtures.js';

test('runOrfeCore sets project status for an issue and returns structured success output', async () => {
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

    const result = await runCoreCommand({
      command: 'project set-status',
      input: { item_type: 'issue', item_number: 13, status: 'In Progress' },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'project set-status',
      repo: 'throw-if-null/orfe',
      data: {
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
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
    assert.equal(mutationApi.isDone(), true);
    assert.equal(observedItemApi.isDone(), true);
    assert.equal(observedFieldsApi.isDone(), true);
  });
});

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

test('runOrfeCore treats project set-status as an idempotent no-op when the requested status already matches', async () => {
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
                  statusValue: createProjectStatusValueNode({ fieldId: 'PVTSSF_lAHOABCD1234', fieldName: 'Status', optionId: 'f75ad846', name: 'In Progress' }),
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

    const result = await runCoreCommand({
      command: 'project set-status',
      input: { item_type: 'issue', item_number: 13, status: 'In Progress' },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.equal(result.ok, true);
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  });
});

test('runOrfeCore fails clearly when project set-status targets an item outside the configured project', async () => {
  await withNock(async () => {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({ id: 'PVTI_elsewhere', projectId: 'PVT_elsewhere', projectOwner: 'throw-if-null', projectNumber: 99 }),
              ]),
            },
          },
        },
      },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'project set-status',
        input: { item_type: 'issue', item_number: 13, status: 'In Progress' },
        repoConfig: createRepoConfigWithDefaultProject(),
      }),
      /Issue #13 is not present on GitHub Project throw-if-null\/1\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore fails clearly when project set-status receives an invalid status option', async () => {
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

    await assert.rejects(
      runCoreCommand({
        command: 'project set-status',
        input: { item_type: 'issue', item_number: 13, status: 'Done' },
        repoConfig: createRepoConfigWithDefaultProject(),
      }),
      /GitHub Project throw-if-null\/1 field "Status" has no option named "Done"\./,
    );

    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  });
});

test('runOrfeCore maps project set-status auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'project set-status',
        input: { item_type: 'issue', item_number: 13, status: 'In Progress' },
        repoConfig: createRepoConfigWithDefaultProject(),
      }),
      /GitHub App authentication failed while setting project status for issue #13\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore supports explicit status field overrides for project set-status', async () => {
  await withNock(async () => {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      statusFieldName: 'Delivery',
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
                  statusValue: createProjectStatusValueNode({ fieldId: 'PVTSSF_delivery', fieldName: 'Delivery', optionId: 'f75ad847', name: 'Queued' }),
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
                ...createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' }),
                options: [
                  { id: 'f75ad847', name: 'Queued' },
                  { id: 'f75ad848', name: 'Shipped' },
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
                ...createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' }),
                options: [
                  { id: 'f75ad847', name: 'Queued' },
                  { id: 'f75ad848', name: 'Shipped' },
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
      fieldId: 'PVTSSF_delivery',
      optionId: 'f75ad848',
    });
    const observedItemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      statusFieldName: 'Delivery',
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
                  statusValue: createProjectStatusValueNode({ fieldId: 'PVTSSF_delivery', fieldName: 'Delivery', optionId: 'f75ad848', name: 'Shipped' }),
                }),
              ]),
            },
          },
        },
      },
    });

    const result = await runCoreCommand({
      command: 'project set-status',
      input: { item_type: 'issue', item_number: 13, status_field_name: 'Delivery', status: 'Shipped' },
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
