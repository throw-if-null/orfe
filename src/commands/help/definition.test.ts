import assert from 'node:assert/strict';
import test from 'node:test';

import { COMMANDS } from '../index.js';
import { helpCommand } from '../index.js';
import { createHelpCommandSuccessData, createHelpRootSuccessData } from './definition.js';

test('help slice owns its command metadata and contract examples', () => {
  assert.equal(helpCommand.name, 'help');
  assert.equal(helpCommand.group, 'help');
  assert.equal(helpCommand.leaf, 'help');
  assert.equal(helpCommand.topLevel, true);
  assert.deepEqual(helpCommand.validInputExample, { command_name: 'issue get' });
  assert.deepEqual(helpCommand.successDataExample, createHelpCommandSuccessData(COMMANDS, 'issue get'));
});

test('help root data exposes discovery flow and grouped next steps for agents', () => {
  const rootHelp = createHelpRootSuccessData(COMMANDS);

  assert.equal(rootHelp.scope, 'root');
  assert.equal(rootHelp.canonical_command_name, 'help');
  assert.deepEqual(rootHelp.requirements, {
    caller_context: 'not_required',
    repo_local_config: 'not_required',
    machine_local_auth_config: 'not_required',
    github_access: 'not_required',
  });
  assert.match(rootHelp.discovery_flow[0] ?? '', /Start with \{ "command": "help" \}/);
  assert.equal(rootHelp.top_level_help.next_step.tool_input.command, 'help');
  assert.equal(rootHelp.top_level_help.next_step.tool_input.command_name, 'issue get');
  assert.equal(rootHelp.command_groups.some((group) => group.name === 'issue'), true);
  assert.equal(rootHelp.command_groups.some((group) => group.name === 'pr'), true);
  assert.equal(rootHelp.command_groups.some((group) => group.name === 'project'), true);
});

test('help command data exposes representative next-step metadata across groups', () => {
  const issueGetHelp = createHelpCommandSuccessData(COMMANDS, 'issue get');
  const prGetOrCreateHelp = createHelpCommandSuccessData(COMMANDS, 'pr get-or-create');
  const projectSetStatusHelp = createHelpCommandSuccessData(COMMANDS, 'project set-status');

  assert.deepEqual(issueGetHelp.requirements, {
    caller_context: 'required',
    repo_local_config: 'required',
    machine_local_auth_config: 'required',
    github_access: 'required',
  });
  assert.equal(issueGetHelp.supported_input_fields.some((field) => field.input_key === 'issue_number' && field.required), true);

  assert.equal(prGetOrCreateHelp.canonical_command_name, 'pr get-or-create');
  assert.equal(prGetOrCreateHelp.supported_input_fields.some((field) => field.input_key === 'head' && field.required), true);
  assert.equal(prGetOrCreateHelp.supported_input_fields.some((field) => field.input_key === 'body_contract'), true);

  assert.equal(projectSetStatusHelp.canonical_command_name, 'project set-status');
  assert.equal(projectSetStatusHelp.supported_input_fields.some((field) => field.input_key === 'item_type' && field.required), true);
  assert.equal(projectSetStatusHelp.supported_input_fields.some((field) => field.input_key === 'status' && field.required), true);
});
