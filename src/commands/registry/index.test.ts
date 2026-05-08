import assert from 'node:assert/strict';
import { test } from 'vitest';

import { COMMANDS } from '../index.js';
import { getCommandDefinition, getTopLevelCommandDefinition, listCommandGroups, listCommandNames } from './index.js';

test('registry lists command names in registration order', () => {
  assert.deepEqual(listCommandNames(), COMMANDS.map((definition) => definition.name));
});

test('registry derives unique command groups and keeps top-level commands out of them', () => {
  assert.deepEqual(
    listCommandGroups(),
    COMMANDS.filter((definition) => !definition.topLevel)
      .map((definition) => definition.group)
      .filter((group, index, groups) => groups.indexOf(group) === index),
  );
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

test('registry rejects unknown commands', () => {
  assert.throws(() => getCommandDefinition('issue unknown'), /Unknown command "issue unknown"\./);
  assert.equal(getTopLevelCommandDefinition('issue unknown'), undefined);
});
