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
} from '../mocks/github.js';
import { createRepoConfigWithDefaultProject } from '../../../../test/support/runtime-fixtures.js';

test('runOrfeCore reads project status for an issue and returns structured success output', async () => {
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
                  fields: [createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' })],
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

    const result = await runCoreCommand({
      command: 'project get-status',
      input: { item_type: 'issue', item_number: 13 },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'project get-status',
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
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  });
});

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

test('runOrfeCore paginates project items so later matching items are found', async () => {
  await withNock(async () => {
    const firstPageApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection(
                [createProjectItemNode({ id: 'PVTI_elsewhere', projectId: 'PVT_elsewhere', projectOwner: 'throw-if-null', projectNumber: 99 })],
                { hasNextPage: true, endCursor: 'cursor-1' },
              ),
            },
          },
        },
      },
    });
    const secondPageApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      projectItemsCursor: 'cursor-1',
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

    const result = await runCoreCommand({
      command: 'project get-status',
      input: { item_type: 'issue', item_number: 13 },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.equal(result.ok, true);
    assert.equal(firstPageApi.isDone(), true);
    assert.equal(secondPageApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  });
});

test('runOrfeCore paginates project fields so later matching fields are found', async () => {
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
    const firstFieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' })], {
              hasNextPage: true,
              endCursor: 'fields-cursor-1',
            }),
          },
        },
      },
    });
    const secondFieldsApi = mockProjectStatusFieldsRequest({
      projectId: 'PVT_project_1',
      fieldsCursor: 'fields-cursor-1',
      graphqlResponseBody: {
        data: {
          node: {
            fields: createProjectFieldsConnection([createProjectStatusFieldNode({ id: 'PVTSSF_lAHOABCD1234', name: 'Status' })]),
          },
        },
      },
    });

    const result = await runCoreCommand({
      command: 'project get-status',
      input: { item_type: 'issue', item_number: 13 },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.equal(result.ok, true);
    assert.equal(itemApi.isDone(), true);
    assert.equal(firstFieldsApi.isDone(), true);
    assert.equal(secondFieldsApi.isDone(), true);
  });
});

test('runOrfeCore reads project status for a pull request and returns structured success output', async () => {
  await withNock(async () => {
    const itemApi = mockProjectGetStatusRequest({
      itemType: 'pr',
      itemNumber: 9,
      graphqlResponseBody: {
        data: {
          repository: {
            pullRequest: {
              projectItems: createProjectItemsConnection([
                createProjectItemNode({
                  id: 'PVTI_pr1234',
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

    const result = await runCoreCommand({
      command: 'project get-status',
      input: { item_type: 'pr', item_number: 9 },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.equal(result.ok, true);
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  });
});

test('runOrfeCore fails clearly when the target issue is not on the configured project', async () => {
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
        command: 'project get-status',
        input: { item_type: 'issue', item_number: 13 },
        repoConfig: createRepoConfigWithDefaultProject(),
      }),
      /Issue #13 is not present on GitHub Project throw-if-null\/1\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore fails clearly when the configured project is missing the Status field', async () => {
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
                  fields: [createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' })],
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
            fields: createProjectFieldsConnection([createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' })]),
          },
        },
      },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'project get-status',
        input: { item_type: 'issue', item_number: 13 },
        repoConfig: createRepoConfigWithDefaultProject(),
      }),
      /GitHub Project throw-if-null\/1 has no single-select field named "Status"\./,
    );

    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  });
});

test('runOrfeCore maps project get-status auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'project get-status',
        input: { item_type: 'issue', item_number: 13 },
        repoConfig: createRepoConfigWithDefaultProject(),
      }),
      /GitHub App authentication failed while reading project status for issue #13\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore supports explicit status field overrides for project get-status', async () => {
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
                  fields: [createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' })],
                  statusValue: createProjectStatusValueNode({
                    fieldId: 'PVTSSF_delivery',
                    fieldName: 'Delivery',
                    optionId: 'f75ad847',
                    name: 'Shipped',
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
            fields: createProjectFieldsConnection([createProjectStatusFieldNode({ id: 'PVTSSF_delivery', name: 'Delivery' })]),
          },
        },
      },
    });

    const result = await runCoreCommand({
      command: 'project get-status',
      input: { item_type: 'issue', item_number: 13, status_field_name: 'Delivery' },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.equal(result.ok, true);
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  });
});
