import assert from 'node:assert/strict';

import { test } from 'vitest';

import { validateCommandInput } from '../../registry/index.js';
import { assertDefinitionIdentity, assertOption, assertValidInputExample } from '../../../../test/support/definition-test.js';
import { prUpdateCommand } from './definition.js';

test('pr update definition keeps title/body mutation metadata aligned', () => {
  assertDefinitionIdentity(prUpdateCommand, { name: 'pr update', group: 'pr', leaf: 'update', execution: 'github' });
  assertOption(prUpdateCommand, 'pr_number', { flag: '--pr-number', type: 'number', required: true });
  assertOption(prUpdateCommand, 'template', { flag: '--template', type: 'string' });
  assertValidInputExample(prUpdateCommand);
  assert.equal(prUpdateCommand.successDataExample.changed, true);
});

test('pr update definition validation rejects template-only and empty mutations', () => {
  assert.throws(
    () => validateCommandInput(prUpdateCommand, { pr_number: 9, template: 'implementation-ready@1.0.0' }),
    /pr update only allows template together with --body\./,
  );
  assert.throws(() => validateCommandInput(prUpdateCommand, { pr_number: 9 }), /pr update requires at least one mutation option\./);
});
