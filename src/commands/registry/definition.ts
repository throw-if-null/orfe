import type { CommandDefinition, CommandDefinitionInput, CommandGroupFromName, CommandLeafFromName } from './types.js';

export function createCommandDefinition<
  const TName extends `${string} ${string}`,
  TInput extends Record<string, unknown>,
  TData extends object,
>(definition: CommandDefinitionInput<TName, TInput, TData>): CommandDefinition<TName, TInput, TData> {
  const separatorIndex = definition.name.indexOf(' ');
  if (separatorIndex <= 0 || separatorIndex >= definition.name.length - 1) {
    throw new Error(`Command name "${definition.name}" must be in "group leaf" format.`);
  }

  const group = definition.name.slice(0, separatorIndex) as CommandGroupFromName<TName>;
  const leaf = definition.name.slice(separatorIndex + 1) as CommandLeafFromName<TName>;

  return {
    ...definition,
    group,
    leaf,
  };
}
