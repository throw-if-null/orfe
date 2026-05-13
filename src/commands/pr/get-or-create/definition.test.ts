import assert from 'node:assert/strict';

import { test } from 'vitest';

import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { prGetOrCreateCommand } from './definition.js';

test('pr get-or-create definition keeps branch, title, and draft metadata aligned', () => {
  assertDefinitionIdentity(prGetOrCreateCommand, { name: 'pr get-or-create', group: 'pr', leaf: 'get-or-create', execution: 'github' });
  assertOption(prGetOrCreateCommand, 'head', { flag: '--head', type: 'string', required: true });
  assertOption(prGetOrCreateCommand, 'title', { flag: '--title', type: 'string', required: true });
  assertOption(prGetOrCreateCommand, 'draft', { flag: '--draft', type: 'boolean' });
  assertValidInputExample(prGetOrCreateCommand);
  assert.equal(prGetOrCreateCommand.successDataExample.created, false);
});
