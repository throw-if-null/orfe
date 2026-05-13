import { getCliCommonOptions, getGroupDefinitions, listCommandDefinitions, listCommandGroups, type CommandDefinition, type CommandOptionDefinition } from '../commands/registry/index.js';

import type { OrfeCommandGroup } from './types.js';

export function renderRootHelp(): string {
  const commandGroups = listCommandGroups();
  const rootExamples = listCommandDefinitions()
    .flatMap((definition) => definition.examples)
    .filter((example, index, examples) => example.trim().length > 0 && examples.indexOf(example) === index)
    .slice(0, 2);

  return [
    'orfe - generic GitHub operations runtime',
    '',
    'Usage:',
    `  orfe <${commandGroups.join('|')}> <command> [options]`,
    '  orfe --help',
    '  orfe --version',
    '',
    'Command groups:',
    ...commandGroups.map((group) => `  ${group}`),
    '',
    'Examples:',
    ...(rootExamples.length > 0 ? rootExamples.map((example) => `  ${example}`) : ['  orfe --help']),
    '',
    'Run `orfe <group> --help` for group-specific help.',
  ].join('\n');
}

export function renderGroupHelp(group: OrfeCommandGroup): string {
  const groupDefinitions = getGroupDefinitions(group);

  return [
    `orfe ${group}`,
    '',
    'Usage:',
    `  orfe ${group} <command> [options]`,
    '',
    'Commands:',
    ...groupDefinitions.map((definition) => `  ${definition.leaf} - ${definition.purpose}`),
    '',
    'Example:',
    `  ${groupDefinitions[0]?.examples[0] ?? `orfe ${group} --help`}`,
  ].join('\n');
}

export function renderLeafHelp(commandDefinition: CommandDefinition): string {
  const requiredOptions = commandDefinition.options.filter((option) => option.required);
  const optionalOptions = dedupeOptionDefinitions([
    ...commandDefinition.options.filter((option) => !option.required),
    ...getCliCommonOptions().filter((option) => !requiredOptions.some((requiredOption) => requiredOption.flag === option.flag)),
  ]);

  return [
    `${commandDefinition.name}`,
    '',
    `Purpose: ${commandDefinition.purpose}`,
    `Usage: ${commandDefinition.usage}`,
    '',
    'Required options:',
    ...(requiredOptions.length > 0 ? requiredOptions.map(formatOptionLine) : ['  (none)']),
    '',
    'Optional options:',
    ...optionalOptions.map(formatOptionLine),
    '',
    `Success: ${commandDefinition.successSummary}`,
    '',
    'Examples:',
    ...commandDefinition.examples.map((example) => `  ${example}`),
    '',
    'JSON success shape example:',
    `  ${JSON.stringify(commandDefinition.successDataExample)}`,
  ].join('\n');
}

function dedupeOptionDefinitions(optionDefinitions: CommandOptionDefinition[]): CommandOptionDefinition[] {
  const seenFlags = new Set<string>();

  return optionDefinitions.filter((optionDefinition) => {
    if (seenFlags.has(optionDefinition.flag)) {
      return false;
    }

    seenFlags.add(optionDefinition.flag);
    return true;
  });
}

function formatOptionLine(optionDefinition: CommandOptionDefinition): string {
  return `  ${optionDefinition.flag} - ${optionDefinition.description}`;
}
