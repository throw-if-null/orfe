import assert from 'node:assert/strict';

import { test } from 'vitest';

import { runToolCommand } from '../../../../test/support/command-runtime.js';
import { mockIssueCreateRequest } from '../../../../test/support/github/issue.js';
import {
  createProjectLookupResponse,
  mockProjectAddItemRequest,
  mockProjectLookupRequest,
} from '../../../../test/support/github/project.js';
import { withNock } from '../../../../test/support/http-test.js';
import {
  createRepoConfigWithDefaultProject,
  renderIssueTemplateMarker,
} from '../../../../test/support/runtime-fixtures.js';

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

test('executeOrfeTool validates issue bodies through templates before create', async () => {
  await withNock(async () => {
    const issueBody = [
      '## Problem / context',
      '',
      'Need deterministic validation for issue bodies.',
      '',
      '## Desired outcome',
      '',
      'Issue bodies validate against declarative templates.',
      '',
      '## Scope',
      '',
      '### In scope',
      '- declarative templates',
      '',
      '### Out of scope',
      '- executable plugins',
      '',
      '## Acceptance criteria',
      '',
      '- [ ] templates load from .orfe/templates',
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
        body: `${issueBody}\n\n${renderIssueTemplateMarker()}`,
      },
    });

    const result = await runToolCommand({
      input: {
        command: 'issue create',
        title: 'New issue title',
        body: issueBody,
        template: 'formal-work-item@1.0.0',
      },
    });

    assert.equal(result.ok, true);
    assert.equal(api.isDone(), true);
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
