import assert from 'node:assert/strict';
import test from 'node:test';

import { COMMANDS } from '../index.js';
import { getCommandDefinition, listCommandGroups, listCommandNames } from './index.js';

test('registry lists command names from the explicit registration array', () => {
  assert.deepEqual(listCommandNames(), COMMANDS.map((definition) => definition.name));
});

test('registry derives command groups from explicit registrations', () => {
  assert.deepEqual(listCommandGroups(), ['auth', 'issue', 'pr', 'project']);
});

test('registry resolves definitions from the explicit registration array', () => {
  for (const definition of COMMANDS) {
    assert.equal(getCommandDefinition(definition.name), definition);
  }
});
