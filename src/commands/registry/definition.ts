import type { CommandDefinition, CommandDefinitionInput, CommandGroupFromName, CommandLeafFromName } from './types.js';

export function createCommandDefinition<
  const TName extends string,
  TInput extends Record<string, unknown>,
  TData extends object,
>(definition: CommandDefinitionInput<TName, TInput, TData>): CommandDefinition<TName, TInput, TData> {
  const segments = definition.name.split(' ').filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    throw new Error('Command name must not be empty.');
  }

  if (definition.topLevel) {
    if (segments.length !== 1) {
      throw new Error(`Top-level command name "${definition.name}" must be a single token.`);
    }
  } else if (segments.length !== 2) {
    throw new Error(`Command name "${definition.name}" must be in "group leaf" format.`);
  }

  const group = segments[0] as CommandGroupFromName<TName>;
  const leaf = (segments[1] ?? segments[0]) as CommandLeafFromName<TName>;


  return {
    ...definition,
    group,
    leaf,
  };
}
