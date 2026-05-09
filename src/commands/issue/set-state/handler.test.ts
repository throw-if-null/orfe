import assert from 'node:assert/strict';
import { test } from 'vitest';

import { runCoreCommand } from '../../../../test/support/command-runtime.js';
import { withNock } from '../../../../test/support/http-test.js';
import {
  createIssueRestResponse,
  createIssueStateNode,
  mockIssueSetStateDuplicateRequest,
  mockIssueSetStateRequest,
} from '../../../../test/support/issue-fixtures.js';

test('runOrfeCore closes an issue with structured state metadata', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      restUpdateBody: { state: 'closed', state_reason: 'completed' },
      observedIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'COMPLETED',
      }),
    });

    const result = await runCoreCommand({
      command: 'issue set-state',
      input: { issue_number: 14, state: 'closed', state_reason: 'completed' },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'completed',
        duplicate_of_issue_number: null,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore reopens an issue and clears duplicate metadata', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'DUPLICATE',
        duplicateOfIssueNumber: 7,
        duplicateOfId: 'I_7',
      }),
      unmark: { duplicateId: 'I_14', canonicalId: 'I_7' },
      restUpdateBody: { state: 'open' },
      observedIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
    });

    const result = await runCoreCommand({
      command: 'issue set-state',
      input: { issue_number: 14, state: 'open' },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'open',
        state_reason: null,
        duplicate_of_issue_number: null,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore closes an issue as a duplicate and returns canonical issue metadata', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 7,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      canonicalIssueState: createIssueStateNode({ id: 'I_7', issueNumber: 7, state: 'OPEN' }),
      mark: { duplicateId: 'I_14', canonicalId: 'I_7' },
      observedIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'DUPLICATE',
        duplicateOfIssueNumber: 7,
        duplicateOfId: 'I_7',
      }),
    });

    const result = await runCoreCommand({
      command: 'issue set-state',
      input: { issue_number: 14, state: 'closed', state_reason: 'duplicate', duplicate_of: 7 },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'duplicate',
        duplicate_of_issue_number: 7,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore treats matching issue set-state requests as no-ops', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'COMPLETED',
      }),
      includeGraphql: true,
    });

    const result = await runCoreCommand({
      command: 'issue set-state',
      input: { issue_number: 14, state: 'closed', state_reason: 'completed' },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'completed',
        duplicate_of_issue_number: null,
        changed: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps issue set-state missing duplicate target clearly', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 999,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      canonicalIssueState: null,
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue set-state',
        input: { issue_number: 14, state: 'closed', state_reason: 'duplicate', duplicate_of: 999 },
      }),
      /Duplicate target issue #999 was not found\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore rejects pull request duplicate targets for issue set-state clearly', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 48,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      canonicalIssueState: null,
      duplicateTargetGetStatus: 200,
      duplicateTargetGetResponseBody: createIssueRestResponse(48, {
        title: 'Implement `orfe issue set-state`',
        html_url: 'https://github.com/throw-if-null/orfe/pull/48',
        pull_request: {
          url: 'https://api.github.com/repos/throw-if-null/orfe/pulls/48',
        },
      }),
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue set-state',
        input: { issue_number: 14, state: 'closed', state_reason: 'duplicate', duplicate_of: 48 },
      }),
      /Duplicate target issue #48 is a pull request\. --duplicate-of must reference an issue\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore maps issue set-state auth failures clearly', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateRequest({
      issueNumber: 14,
      currentIssueState: createIssueStateNode({ id: 'I_14', issueNumber: 14, state: 'OPEN' }),
      issueGetStatus: 403,
      issueGetResponseBody: { message: 'Resource not accessible by integration' },
      includeGraphql: false,
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue set-state',
        input: { issue_number: 14, state: 'closed', state_reason: 'completed' },
      }),
      /GitHub App authentication failed while setting state for issue #14\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore rejects pull request targets for issue set-state clearly', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateRequest({
      issueNumber: 46,
      currentIssueState: createIssueStateNode({ id: 'I_46', issueNumber: 46, state: 'OPEN' }),
      issueGetResponseBody: {
        number: 46,
        title: 'Implement `orfe issue set-state`',
        body: 'PR body',
        state: 'open',
        state_reason: null,
        labels: [],
        assignees: [],
        html_url: 'https://github.com/throw-if-null/orfe/pull/46',
        pull_request: {
          url: 'https://api.github.com/repos/throw-if-null/orfe/pulls/46',
        },
      },
      includeGraphql: false,
    });

    await assert.rejects(
      runCoreCommand({
        command: 'issue set-state',
        input: { issue_number: 46, state: 'closed', state_reason: 'completed' },
      }),
      /Issue #46 is a pull request\. issue set-state only supports issues\./,
    );

    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore re-targets duplicate issue set-state requests and reports changes', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 9,
      currentIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'DUPLICATE',
        duplicateOfIssueNumber: 7,
        duplicateOfId: 'I_7',
      }),
      canonicalIssueState: createIssueStateNode({ id: 'I_9', issueNumber: 9, state: 'OPEN' }),
      unmark: { duplicateId: 'I_14', canonicalId: 'I_7' },
      mark: { duplicateId: 'I_14', canonicalId: 'I_9' },
      observedIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'DUPLICATE',
        duplicateOfIssueNumber: 9,
        duplicateOfId: 'I_9',
      }),
    });

    const result = await runCoreCommand({
      command: 'issue set-state',
      input: { issue_number: 14, state: 'closed', state_reason: 'duplicate', duplicate_of: 9 },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'duplicate',
        duplicate_of_issue_number: 9,
        changed: true,
      },
    });
    assert.equal(api.isDone(), true);
  });
});

test('runOrfeCore treats matching duplicate issue set-state requests as no-ops', async () => {
  await withNock(async () => {
    const api = mockIssueSetStateDuplicateRequest({
      issueNumber: 14,
      duplicateOfIssueNumber: 7,
      currentIssueState: createIssueStateNode({
        id: 'I_14',
        issueNumber: 14,
        state: 'CLOSED',
        stateReason: 'DUPLICATE',
        duplicateOfIssueNumber: 7,
        duplicateOfId: 'I_7',
      }),
      canonicalIssueState: createIssueStateNode({ id: 'I_7', issueNumber: 7, state: 'OPEN' }),
    });

    const result = await runCoreCommand({
      command: 'issue set-state',
      input: { issue_number: 14, state: 'closed', state_reason: 'duplicate', duplicate_of: 7 },
    });

    assert.deepEqual(result, {
      ok: true,
      command: 'issue set-state',
      repo: 'throw-if-null/orfe',
      data: {
        issue_number: 14,
        state: 'closed',
        state_reason: 'duplicate',
        duplicate_of_issue_number: 7,
        changed: false,
      },
    });
    assert.equal(api.isDone(), true);
  });
});
