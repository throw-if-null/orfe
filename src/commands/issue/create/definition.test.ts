import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { issueCreateCommand } from './definition.js';

test('issue create definition captures template, project, and multi-value option metadata', () => {
  assertDefinitionIdentity(issueCreateCommand, { name: 'issue create', group: 'issue', leaf: 'create', execution: 'github' });
  assertOption(issueCreateCommand, 'title', { flag: '--title', type: 'string', required: true });
  assertOption(issueCreateCommand, 'labels', { flag: '--label', type: 'string-array' });
  assertOption(issueCreateCommand, 'add_to_project', { flag: '--add-to-project', type: 'boolean' });
  assertValidInputExample(issueCreateCommand);
  assert.equal(issueCreateCommand.successDataExample.created, true);
});
