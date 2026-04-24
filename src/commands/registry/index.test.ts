import assert from 'node:assert/strict';
import test from 'node:test';

import { COMMANDS } from '../index.js';
import { getCommandDefinition, getTopLevelCommandDefinition, listCommandGroups, listCommandNames } from './index.js';

test('registry lists command names from the explicit registration array', () => {
  assert.deepEqual(listCommandNames(), COMMANDS.map((definition) => definition.name));
});

test('registry derives command groups from explicit registrations', () => {
  assert.deepEqual(listCommandGroups(), ['auth', 'issue', 'pr', 'project', 'runtime']);
});

test('registry lists the PR validation command from explicit registrations', () => {
  assert(listCommandNames().includes('pr validate'));
});

test('registry lists the issue validation command from explicit registrations', () => {
  assert(listCommandNames().includes('issue validate'));
});

test('registry lists the top-level help command from explicit registrations', () => {
  assert(listCommandNames().includes('help'));
  assert.equal(getTopLevelCommandDefinition('help')?.name, 'help');
});

test('registry marks runtime-only commands explicitly', () => {
  const helpDefinition = getCommandDefinition('help');
  const runtimeInfoDefinition = getCommandDefinition('runtime info');

  assert.equal(helpDefinition.execution, 'runtime');
  assert.equal(runtimeInfoDefinition.execution, 'runtime');
  assert.equal(Object.prototype.hasOwnProperty.call(helpDefinition, 'handler'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(runtimeInfoDefinition, 'handler'), false);
});

test('registry resolves definitions from the explicit registration array', () => {
  for (const definition of COMMANDS) {
    assert.equal(getCommandDefinition(definition.name), definition);
  }
});
