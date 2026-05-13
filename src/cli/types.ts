import type { OrfeCommandGroup } from '../commands/index.js';
import type { CommandDefinition } from '../commands/registry/index.js';
import type { OrfeCoreDependencies } from '../core/types.js';
import type { CommandInput } from '../core/types.js';

export interface ParsedLeafInvocation {
  kind: 'leaf';
  commandDefinition: CommandDefinition;
  callerName: string;
  configPath?: string;
  authConfigPath?: string;
  input: CommandInput;
}

export interface ParsedHelpInvocation {
  kind: 'help';
  output: string;
}

export interface ParsedVersionInvocation {
  kind: 'version';
  output: string;
}

export type ParsedInvocation = ParsedLeafInvocation | ParsedHelpInvocation | ParsedVersionInvocation;

export interface RunCliDependencies extends OrfeCoreDependencies {
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<NodeJS.WriteStream, 'write'>;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
}

export type { OrfeCommandGroup };
