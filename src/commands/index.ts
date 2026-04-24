import type { CommandDefinition } from './registry/types.js';
import { authTokenCommand } from './auth/token/definition.js';
import { createHelpCommand } from './help/definition.js';
import { issueCommentCommand } from './issue/comment/definition.js';
import { issueCreateCommand } from './issue/create/definition.js';
import { issueGetCommand } from './issue/get/definition.js';
import { issueSetStateCommand } from './issue/set-state/definition.js';
import { issueUpdateCommand } from './issue/update/definition.js';
import { issueValidateCommand } from './issue/validate/definition.js';
import { prCommentCommand } from './pr/comment/definition.js';
import { prGetOrCreateCommand } from './pr/get-or-create/definition.js';
import { prGetCommand } from './pr/get/definition.js';
import { prReplyCommand } from './pr/reply/definition.js';
import { prSubmitReviewCommand } from './pr/submit-review/definition.js';
import { prValidateCommand } from './pr/validate/definition.js';
import { projectGetStatusCommand } from './project/get-status/definition.js';
import { projectSetStatusCommand } from './project/set-status/definition.js';
import { runtimeInfoCommand } from './runtime/info/definition.js';

const BASE_COMMANDS = [
  authTokenCommand,
  issueGetCommand,
  issueCreateCommand,
  issueUpdateCommand,
  issueValidateCommand,
  issueCommentCommand,
  issueSetStateCommand,
  prGetCommand,
  prValidateCommand,
  prGetOrCreateCommand,
  prCommentCommand,
  prSubmitReviewCommand,
  prReplyCommand,
  projectGetStatusCommand,
  projectSetStatusCommand,
  runtimeInfoCommand,
] as const satisfies readonly CommandDefinition[];

export const helpCommand = createHelpCommand(() => COMMANDS);

export const COMMANDS = [...BASE_COMMANDS, helpCommand] as const satisfies readonly CommandDefinition[];

export type OrfeCommandName = (typeof COMMANDS)[number]['name'];
type GroupedCommandDefinition = (typeof COMMANDS)[number] extends infer TDefinition
  ? TDefinition extends { topLevel: true }
    ? never
    : TDefinition
  : never;

export type OrfeCommandGroup = GroupedCommandDefinition['group'];
