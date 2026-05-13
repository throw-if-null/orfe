import assert from 'node:assert/strict';

import { validateCommandInput, type CommandDefinition, type CommandOptionDefinition } from '../../src/commands/registry/index.js';

interface ExpectedDefinitionIdentity {
  name: string;
  group: string;
  leaf: string;
  execution: 'github' | 'runtime';
  topLevel?: boolean;
}

export function assertDefinitionIdentity(definition: CommandDefinition, expected: ExpectedDefinitionIdentity): void {
  assert.equal(definition.name, expected.name);
  assert.equal(definition.group, expected.group);
  assert.equal(definition.leaf, expected.leaf);
  assert.equal(definition.execution, expected.execution);
  assert.equal(definition.topLevel ?? false, expected.topLevel ?? false);
}

export function assertOption(
  definition: CommandDefinition,
  key: string,
  expected: Partial<CommandOptionDefinition>,
): CommandOptionDefinition {
  const option = definition.options.find((candidate) => candidate.key === key);
  assert.ok(option, `Expected option "${key}" on command "${definition.name}".`);

  for (const [propertyName, propertyValue] of Object.entries(expected) as Array<[
    keyof CommandOptionDefinition,
    CommandOptionDefinition[keyof CommandOptionDefinition] | undefined,
  ]>) {
    assert.deepEqual(option[propertyName], propertyValue);
  }

  return option;
}

export function assertValidInputExample(definition: CommandDefinition): void {
  assert.deepEqual(
    validateCommandInput(definition as CommandDefinition<string, Record<string, unknown>>, definition.validInputExample),
    definition.validInputExample,
  );
}
