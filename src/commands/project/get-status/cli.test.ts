import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OrfeError } from '../../../../src/runtime/errors.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
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

test('runCli prints structured success JSON for project get-status', async () => {
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

    const result = await invokeCli(['project', 'get-status', '--item-type', 'issue', '--item-number', '13'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
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

test('runCli prints structured success JSON for project get-status when the target is a pull request', async () => {
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

    const result = await invokeCli(['project', 'get-status', '--item-type', 'pr', '--item-number', '9'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'project get-status',
      repo: 'throw-if-null/orfe',
      data: {
        project_owner: 'throw-if-null',
        project_number: 1,
        status_field_name: 'Status',
        status_field_id: 'PVTSSF_lAHOABCD1234',
        item_type: 'pr',
        item_number: 9,
        project_item_id: 'PVTI_pr1234',
        status_option_id: 'f75ad846',
        status: 'In Progress',
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  });
});

test('runCli prints structured project-item-not-found failures for project get-status', async () => {
  await withNock(async () => {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlResponseBody: {
        data: {
          repository: {
            issue: {
              projectItems: createProjectItemsConnection([]),
            },
          },
        },
      },
    });

    const result = await invokeCli(['project', 'get-status', '--item-type', 'issue', '--item-number', '13'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'project get-status',
      error: {
        code: 'project_item_not_found',
        message: 'Issue #13 is not present on GitHub Project throw-if-null/1.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured missing-status-field failures for project get-status', async () => {
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

    const result = await invokeCli(['project', 'get-status', '--item-type', 'issue', '--item-number', '13'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'project get-status',
      error: {
        code: 'project_status_field_not_found',
        message: 'GitHub Project throw-if-null/1 has no single-select field named "Status".',
        retryable: false,
      },
    });
    assert.equal(itemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
  });
});

test('runCli prints structured auth failures for project get-status', async () => {
  await withNock(async () => {
    const api = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 13,
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
    });

    const result = await invokeCli(['project', 'get-status', '--item-type', 'issue', '--item-number', '13'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'project get-status',
      error: {
        code: 'auth_failed',
        message: 'GitHub App authentication failed while reading project status for issue #13.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured config failures for project get-status', async () => {
  const result = await invokeCli(['project', 'get-status', '--item-type', 'issue', '--item-number', '13'], {
    env: { ORFE_CALLER_NAME: 'Greg' },
    loadRepoConfigImpl: async () => {
      throw new OrfeError('config_not_found', 'repo-local config not found at /tmp/.orfe/config.json.');
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: 'project get-status',
    error: {
      code: 'config_not_found',
      message: 'repo-local config not found at /tmp/.orfe/config.json.',
      retryable: false,
    },
  });
});
