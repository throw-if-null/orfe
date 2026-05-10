import assert from 'node:assert/strict';
import { test } from 'vitest';

import { OrfeError } from '../../../../src/errors.js';
import { runCoreCommand, runToolCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockIssueCreateRequest } from '../mocks/github.js';
import {
  createProjectFieldsConnection,
  createProjectItemNode,
  createProjectItemsConnection,
  createProjectLookupResponse,
  createProjectStatusFieldNode,
  createProjectStatusValueNode,
  mockProjectAddItemRequest,
  mockProjectGetStatusRequest,
  mockProjectLookupRequest,
  mockProjectStatusFieldsRequest,
  mockProjectStatusUpdateRequest,
} from '../../project/mocks/github.js';
import {
  createRepoConfigWithDefaultProject,
  renderIssueBodyContractMarker,
} from '../../../../test/support/runtime-fixtures.js';

test('runOrfeCore creates a generic issue and returns structured success output', async () => {
  await withNock(async () => {
    const api = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
        body: 'Body text',
        labels: ['needs-input'],
        assignees: ['greg'],
      },
    });

    const result = await runCoreCommand({
      command: 'issue create',
      input: {
        title: 'New issue title',
        body: 'Body text',
        labels: ['needs-input'],
        assignees: ['greg'],
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('executeOrfeTool returns the shared success envelope for issue create', async () => {
  await withNock(async () => {
    const api = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
        body: 'Body text',
        labels: ['needs-input'],
        assignees: ['greg'],
      },
    });

    const result = await runToolCommand({
      input: {
        command: 'issue create',
        title: 'New issue title',
        body: 'Body text',
        labels: ['needs-input'],
        assignees: ['greg'],
      },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore validates issue-create bodies against explicit contracts and appends provenance', async () => {
  await withNock(async () => {
    const issueBody = [
      '## Problem / context',
      '',
      'Need deterministic issue-body validation.',
      '',
      '## Desired outcome',
      '',
      'Agent-authored issues validate against a versioned contract.',
      '',
      '## Scope',
      '',
      '### In scope',
      '- declarative contracts',
      '',
      '### Out of scope',
      '- executable plugins',
      '',
      '## Acceptance criteria',
      '',
      '- [ ] contracts load from .orfe/contracts',
      '',
      '## Docs impact',
      '',
      '- Docs impact: add new durable docs',
      '',
      '## ADR needed?',
      '',
      '- ADR needed: yes',
    ].join('\n');

    const api = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
        body: `${issueBody}\n\n${renderIssueBodyContractMarker()}`,
      },
    });

    const result = await runCoreCommand({
      command: 'issue create',
      input: {
        title: 'New issue title',
        body: issueBody,
        body_contract: 'formal-work-item@1.0.0',
      },
    });

    assert.equal(result.ok, true);
    assert.equal(api.isDone(), true);
  });
});

test('executeOrfeTool validates issue bodies through body contracts before create', async () => {
  await withNock(async () => {
    const issueBody = [
      '## Problem / context',
      '',
      'Need deterministic validation for issue bodies.',
      '',
      '## Desired outcome',
      '',
      'Issue bodies validate against declarative contracts.',
      '',
      '## Scope',
      '',
      '### In scope',
      '- declarative contracts',
      '',
      '### Out of scope',
      '- executable plugins',
      '',
      '## Acceptance criteria',
      '',
      '- [ ] contracts load from .orfe/contracts',
      '',
      '## Docs impact',
      '',
      '- Docs impact: add new durable docs',
      '',
      '## ADR needed?',
      '',
      '- ADR needed: yes',
    ].join('\n');

    const api = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
        body: `${issueBody}\n\n${renderIssueBodyContractMarker()}`,
      },
    });

    const result = await runToolCommand({
      input: {
        command: 'issue create',
        title: 'New issue title',
        body: issueBody,
        body_contract: 'formal-work-item@1.0.0',
      },
    });

    assert.equal(result.ok, true);
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore can create an issue and add it to the default project when explicitly requested', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      projectItemId: 'PVTI_lAHOABCD1234',
      includeAuth: false,
    });

    const result = await runCoreCommand({
      command: 'issue create',
      input: { title: 'New issue title', add_to_project: true },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
        project_assignment: {
          project_owner: 'throw-if-null',
          project_number: 1,
          project_item_id: 'PVTI_lAHOABCD1234',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('executeOrfeTool returns project assignment details for issue create when explicitly requested', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });
    const api = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      graphqlResponseBody: createProjectLookupResponse({ projectId: 'PVT_project_1', ownerType: 'organization' }),
      includeAuth: false,
    });
    const addApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      projectItemId: 'PVTI_lAHOABCD1234',
      includeAuth: false,
    });

    const result = await runToolCommand({
      input: { command: 'issue create', title: 'New issue title', add_to_project: true },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
        project_assignment: {
          project_owner: 'throw-if-null',
          project_number: 1,
          project_item_id: 'PVTI_lAHOABCD1234',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(api.isDone(), true);
    assert.equal(addApi.isDone(), true);
  });
});

test('runCli prints structured success JSON for issue create', async () => {
  await withNock(async () => {
    const api = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
        body: 'Body text',
        labels: ['needs-input'],
        assignees: ['greg'],
      },
    });

    const result = await invokeCli(
      [
        'issue',
        'create',
        '--title',
        'New issue title',
        '--body',
        'Body text',
        '--label',
        'needs-input',
        '--assignee',
        'greg',
      ],
      {
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured success JSON for issue create with explicit project assignment', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
      },
    });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      projectItemId: 'PVTI_lAHOABCD1234',
      includeAuth: false,
    });

    const result = await invokeCli(['issue', 'create', '--title', 'New issue title', '--add-to-project'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
        project_assignment: {
          project_owner: 'throw-if-null',
          project_number: 1,
          project_item_id: 'PVTI_lAHOABCD1234',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('runCli prints structured success JSON for issue create with a user-owned project assignment', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
      },
    });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'octocat',
      projectNumber: 7,
      projectId: 'PVT_project_user_7',
      graphqlResponseBody: createProjectLookupResponse({ projectId: 'PVT_project_user_7', ownerType: 'user' }),
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_user_7',
      contentId: 'I_kwDOOrfeIssue21',
      projectItemId: 'PVTI_lAHOABCDUSER',
      includeAuth: false,
    });

    const result = await invokeCli(
      ['issue', 'create', '--title', 'New issue title', '--add-to-project', '--project-owner', 'octocat', '--project-number', '7'],
      {
        env: { ORFE_CALLER_NAME: 'Greg' },
        ...createRuntimeDependencies(),
        githubClientFactory: createGitHubClientFactory(),
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
        project_assignment: {
          project_owner: 'octocat',
          project_number: 7,
          project_item_id: 'PVTI_lAHOABCDUSER',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('runCli prints structured partial-failure details when issue create project add fails', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
      },
    });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
      includeAuth: false,
    });

    const result = await invokeCli(['issue', 'create', '--title', 'New issue title', '--add-to-project'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'issue create',
      error: {
        code: 'auth_failed',
        message:
          'Issue #21 was created, but adding it to GitHub Project throw-if-null/1 failed: GitHub App authentication failed while adding issue #21 to a GitHub Project.',
        retryable: false,
        details: {
          stage: 'project_add',
          created_issue: {
            issue_number: 21,
            title: 'New issue title',
            state: 'open',
            html_url: 'https://github.com/throw-if-null/orfe/issues/21',
            created: true,
          },
          project_owner: 'throw-if-null',
          project_number: 1,
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('runCli reports project_add failure details when status was requested but project add fails', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
      },
    });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
      includeAuth: false,
    });

    const result = await invokeCli(['issue', 'create', '--title', 'New issue title', '--status', 'Todo'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'issue create',
      error: {
        code: 'auth_failed',
        message:
          'Issue #21 was created, but adding it to GitHub Project throw-if-null/1 failed: GitHub App authentication failed while adding issue #21 to a GitHub Project.',
        retryable: false,
        details: {
          stage: 'project_add',
          created_issue: {
            issue_number: 21,
            title: 'New issue title',
            state: 'open',
            html_url: 'https://github.com/throw-if-null/orfe/issues/21',
            created: true,
          },
          project_owner: 'throw-if-null',
          project_number: 1,
          status_field_name: 'Status',
          requested_status: 'Todo',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('runCli validates issue bodies against explicit contracts and appends provenance', async () => {
  await withNock(async () => {
    const issueBody = [
      '## Problem / context',
      '',
      'Need deterministic validation for issue bodies.',
      '',
      '## Desired outcome',
      '',
      'Issue bodies validate against declarative contracts.',
      '',
      '## Scope',
      '',
      '### In scope',
      '- declarative contracts',
      '',
      '### Out of scope',
      '- executable plugins',
      '',
      '## Acceptance criteria',
      '',
      '- [ ] contracts load from .orfe/contracts',
      '',
      '## Docs impact',
      '',
      '- Docs impact: add new durable docs',
      '',
      '## ADR needed?',
      '',
      '- ADR needed: yes',
    ].join('\n');

    const api = mockIssueCreateRequest({
      requestBody: {
        title: 'New issue title',
        body: `${issueBody}\n\n${renderIssueBodyContractMarker()}`,
      },
    });

    const result = await invokeCli(['issue', 'create', '--title', 'New issue title', '--body', issueBody, '--body-contract', 'formal-work-item@1.0.0'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured auth failures for issue create', async () => {
  await withNock(async () => {
    const api = mockIssueCreateRequest({
      requestBody: { title: 'New issue title' },
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    const result = await invokeCli(['issue', 'create', '--title', 'New issue title'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'issue create',
      error: {
        code: 'auth_failed',
        message: 'GitHub App authentication failed while creating an issue in throw-if-null/orfe.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured repository-not-found failures for issue create', async () => {
  await withNock(async () => {
    const api = mockIssueCreateRequest({
      repo: { owner: 'octo', name: 'missing' },
      requestBody: { title: 'New issue title' },
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    const result = await invokeCli(['issue', 'create', '--title', 'New issue title', '--repo', 'octo/missing'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'issue create',
      error: {
        code: 'github_not_found',
        message: 'Repository octo/missing was not found.',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runCli prints structured creation failures for issue create', async () => {
  await withNock(async () => {
    const api = mockIssueCreateRequest({
      requestBody: { title: 'New issue title' },
      status: 422,
      responseBody: { message: 'Validation Failed' },
    });

    const result = await invokeCli(['issue', 'create', '--title', 'New issue title'], {
      env: { ORFE_CALLER_NAME: 'Greg' },
      ...createRuntimeDependencies(),
      githubClientFactory: createGitHubClientFactory(),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), {
      ok: false,
      command: 'issue create',
      error: {
        code: 'internal_error',
        message: 'GitHub issue creation failed with status 422: Validation Failed',
        retryable: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore can create an issue and add it to a user-owned project when explicitly requested', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'octocat',
      projectNumber: 7,
      projectId: 'PVT_project_user_7',
      graphqlResponseBody: createProjectLookupResponse({ projectId: 'PVT_project_user_7', ownerType: 'user' }),
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_user_7',
      contentId: 'I_kwDOOrfeIssue21',
      projectItemId: 'PVTI_lAHOABCDUSER',
      includeAuth: false,
    });

    const result = await runCoreCommand({
      command: 'issue create',
      input: { title: 'New issue title', add_to_project: true, project_owner: 'octocat', project_number: 7 },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
        project_assignment: {
          project_owner: 'octocat',
          project_number: 7,
          project_item_id: 'PVTI_lAHOABCDUSER',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('runOrfeCore can create an issue and add it to an organization-owned project when explicitly requested', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_org_1',
      graphqlResponseBody: createProjectLookupResponse({ projectId: 'PVT_project_org_1', ownerType: 'organization' }),
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_org_1',
      contentId: 'I_kwDOOrfeIssue21',
      projectItemId: 'PVTI_lAHOABCDORG',
      includeAuth: false,
    });

    const result = await runCoreCommand({
      command: 'issue create',
      input: { title: 'New issue title', add_to_project: true },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
        project_assignment: {
          project_owner: 'throw-if-null',
          project_number: 1,
          project_item_id: 'PVTI_lAHOABCDORG',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('executeOrfeTool returns project assignment details for issue create with a user-owned project', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'octocat',
      projectNumber: 7,
      projectId: 'PVT_project_user_7',
      graphqlResponseBody: createProjectLookupResponse({ projectId: 'PVT_project_user_7', ownerType: 'user' }),
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_user_7',
      contentId: 'I_kwDOOrfeIssue21',
      projectItemId: 'PVTI_lAHOABCDUSER',
      includeAuth: false,
    });

    const result = await runToolCommand({
      input: {
        command: 'issue create',
        title: 'New issue title',
        add_to_project: true,
        project_owner: 'octocat',
        project_number: 7,
      },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
        project_assignment: {
          project_owner: 'octocat',
          project_number: 7,
          project_item_id: 'PVTI_lAHOABCDUSER',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('runOrfeCore can create an issue, add it to a project, and set initial status', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      projectItemId: 'PVTI_lAHOABCD1234',
      includeAuth: false,
    });
    const currentItemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 21,
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
    const mutationApi = mockProjectStatusUpdateRequest({
      projectId: 'PVT_project_1',
      itemId: 'PVTI_lAHOABCD1234',
      fieldId: 'PVTSSF_lAHOABCD1234',
      optionId: 'f75ad845',
    });
    const observedItemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 21,
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
                    optionId: 'f75ad845',
                    name: 'Todo',
                  }),
                }),
              ]),
            },
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

    const result = await runCoreCommand({
      command: 'issue create',
      input: { title: 'New issue title', status: 'Todo' },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
        project_assignment: {
          project_owner: 'throw-if-null',
          project_number: 1,
          project_item_id: 'PVTI_lAHOABCD1234',
          status_field_name: 'Status',
          status_option_id: 'f75ad845',
          status: 'Todo',
        },
      },
    });
    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
    assert.equal(currentItemApi.isDone(), true);
    assert.equal(fieldsApi.isDone(), true);
    assert.equal(mutationApi.isDone(), true);
    assert.equal(observedItemApi.isDone(), true);
    assert.equal(observedFieldsApi.isDone(), true);
  });
});

test('runOrfeCore preserves create-only behavior when repo config has a default project but no project assignment was requested', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });

    const result = await runCoreCommand({
      command: 'issue create',
      input: { title: 'New issue title' },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue create',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 21,
        title: 'New issue title',
        state: 'open',
        html_url: 'https://github.com/throw-if-null/orfe/issues/21',
        created: true,
      },
    });
    assert.equal(issueApi.isDone(), true);
  });
});

test('runOrfeCore surfaces partial failure details when issue create succeeds but project add fails', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
      includeAuth: false,
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue create',
        input: { title: 'New issue title', add_to_project: true },
        repoConfig: createRepoConfigWithDefaultProject(),
      }),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(
          error.message,
          'Issue #21 was created, but adding it to GitHub Project throw-if-null/1 failed: GitHub App authentication failed while adding issue #21 to a GitHub Project.',
        );
        assert.deepEqual(error.details, {
          stage: 'project_add',
          created_issue: {
            issue_number: 21,
            title: 'New issue title',
            state: 'open',
            html_url: 'https://github.com/throw-if-null/orfe/issues/21',
            created: true,
          },
          project_owner: 'throw-if-null',
          project_number: 1,
        });
        return true;
      },
    );

    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('executeOrfeTool returns partial-failure details for issue create project assignment errors', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
      includeAuth: false,
    });

    const result = await runToolCommand({
      input: { command: 'issue create', title: 'New issue title', add_to_project: true },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.deepEqual(result, {
      ok: false,
      command: 'issue create',
      error: {
        code: 'auth_failed',
        message:
          'Issue #21 was created, but adding it to GitHub Project throw-if-null/1 failed: GitHub App authentication failed while adding issue #21 to a GitHub Project.',
        retryable: false,
        details: {
          stage: 'project_add',
          created_issue: {
            issue_number: 21,
            title: 'New issue title',
            state: 'open',
            html_url: 'https://github.com/throw-if-null/orfe/issues/21',
            created: true,
          },
          project_owner: 'throw-if-null',
          project_number: 1,
        },
      },
    });

    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('runOrfeCore reports project_add when status was requested but project add fails', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
      includeAuth: false,
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue create',
        input: { title: 'New issue title', status: 'Todo' },
        repoConfig: createRepoConfigWithDefaultProject(),
      }),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.deepEqual(error.details, {
          stage: 'project_add',
          created_issue: {
            issue_number: 21,
            title: 'New issue title',
            state: 'open',
            html_url: 'https://github.com/throw-if-null/orfe/issues/21',
            created: true,
          },
          project_owner: 'throw-if-null',
          project_number: 1,
          status_field_name: 'Status',
          requested_status: 'Todo',
        });
        return true;
      },
    );

    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('executeOrfeTool returns project_add partial-failure details when status was requested but project add failed', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
      includeAuth: false,
    });

    const result = await runToolCommand({
      input: { command: 'issue create', title: 'New issue title', status: 'Todo' },
      repoConfig: createRepoConfigWithDefaultProject(),
    });

    assert.deepEqual(result, {
      ok: false,
      command: 'issue create',
      error: {
        code: 'auth_failed',
        message:
          'Issue #21 was created, but adding it to GitHub Project throw-if-null/1 failed: GitHub App authentication failed while adding issue #21 to a GitHub Project.',
        retryable: false,
        details: {
          stage: 'project_add',
          created_issue: {
            issue_number: 21,
            title: 'New issue title',
            state: 'open',
            html_url: 'https://github.com/throw-if-null/orfe/issues/21',
            created: true,
          },
          project_owner: 'throw-if-null',
          project_number: 1,
          status_field_name: 'Status',
          requested_status: 'Todo',
        },
      },
    });

    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
  });
});

test('runOrfeCore surfaces partial failure details when issue create succeeds but project status fails', async () => {
  await withNock(async () => {
    const issueApi = mockIssueCreateRequest({ requestBody: { title: 'New issue title' } });
    const projectLookupApi = mockProjectLookupRequest({
      projectOwner: 'throw-if-null',
      projectNumber: 1,
      projectId: 'PVT_project_1',
      includeAuth: false,
    });
    const projectAddApi = mockProjectAddItemRequest({
      projectId: 'PVT_project_1',
      contentId: 'I_kwDOOrfeIssue21',
      projectItemId: 'PVTI_lAHOABCD1234',
      includeAuth: false,
    });
    const currentItemApi = mockProjectGetStatusRequest({
      itemType: 'issue',
      itemNumber: 21,
      includeAuth: false,
      graphqlStatus: 403,
      graphqlResponseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue create',
        input: { title: 'New issue title', status: 'Todo' },
        repoConfig: createRepoConfigWithDefaultProject(),
      }),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'auth_failed');
        assert.equal(
          error.message,
          'Issue #21 was created and added to GitHub Project throw-if-null/1, but setting initial status failed: GitHub App authentication failed while setting project status for issue #21.',
        );
        assert.deepEqual(error.details, {
          stage: 'project_status',
          created_issue: {
            issue_number: 21,
            title: 'New issue title',
            state: 'open',
            html_url: 'https://github.com/throw-if-null/orfe/issues/21',
            created: true,
          },
          project_owner: 'throw-if-null',
          project_number: 1,
          status_field_name: 'Status',
          requested_status: 'Todo',
        });
        return true;
      },
    );

    assert.equal(issueApi.isDone(), true);
    assert.equal(projectLookupApi.isDone(), true);
    assert.equal(projectAddApi.isDone(), true);
    assert.equal(currentItemApi.isDone(), true);
  });
});

test('runOrfeCore maps issue create auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockIssueCreateRequest({
      requestBody: { title: 'New issue title' },
      status: 403,
      responseBody: { message: 'Resource not accessible by integration' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue create',
        input: { title: 'New issue title' },
      }),
      /GitHub App authentication failed while creating an issue in throw-if-null\/orfe\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps issue create missing repository failures clearly', async () => {
  await withNock(async () => {
    const api = mockIssueCreateRequest({
      repo: { owner: 'octo', name: 'missing' },
      requestBody: { title: 'New issue title' },
      status: 404,
      responseBody: { message: 'Not Found' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue create',
        input: { title: 'New issue title', repo: 'octo/missing' },
      }),
      /Repository octo\/missing was not found\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps issue create creation failures clearly', async () => {
  await withNock(async () => {
    const api = mockIssueCreateRequest({
      requestBody: { title: 'New issue title' },
      status: 422,
      responseBody: { message: 'Validation Failed' },
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue create',
        input: { title: 'New issue title' },
      }),
      (error: unknown) => {
        assert(error instanceof OrfeError);
        assert.equal(error.code, 'internal_error');
        assert.equal(error.message, 'GitHub issue creation failed with status 422: Validation Failed');
        assert.equal(error.retryable, false);
        return true;
      },
    );

    assert.equal(api.isDone(), true);
  });
});
