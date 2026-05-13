import assert from 'node:assert/strict';

import { test } from 'vitest';

import { createGitHubClientFactory, createRuntimeDependencies, invokeCli } from '../../../../test/support/cli-test.js';
import { mockIssueCreateRequest } from '../../../../test/support/github/issue.js';
import {
  createProjectLookupResponse,
  mockProjectAddItemRequest,
  mockProjectLookupRequest,
} from '../../../../test/support/github/project.js';
import { withNock } from '../../../../test/support/http-test.js';
import { renderIssueTemplateMarker } from '../../../../test/support/runtime-fixtures.js';

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

test('runCli validates issue bodies against explicit templates and appends provenance', async () => {
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

    const result = await invokeCli(['issue', 'create', '--title', 'New issue title', '--body', issueBody, '--template', 'formal-work-item@1.0.0'], {
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
