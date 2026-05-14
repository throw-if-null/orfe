import assert from 'node:assert/strict';

import { test } from 'vitest';

import { COMMANDS, helpCommand } from '../index.js';
import { validateCommandInput } from '../registry/index.js';
import { createHelpCommandSuccessData, createHelpRootSuccessData } from './definition.js';

test('help root success data excludes top-level commands and groups registered slices', () => {
  const data = createHelpRootSuccessData(COMMANDS);

  assert.deepEqual(
    data.command_groups.map((group) => group.name),
    ['auth', 'issue', 'pr', 'project', 'runtime'],
  );
  assert.equal(
    data.command_groups.flatMap((group) => group.commands.map((command) => command.canonical_command_name)).includes('help'),
    false,
  );
  assert.equal(
    data.command_groups.flatMap((group) => group.commands.map((command) => command.canonical_command_name)).includes('runtime info'),
    true,
  );
});

test('help command success data merges required options, common CLI options, and requirements', () => {
  const issueGetHelp = createHelpCommandSuccessData(COMMANDS, 'issue get');
  const issueValidateHelp = createHelpCommandSuccessData(COMMANDS, 'issue validate');

  assert.deepEqual(validateCommandInput(helpCommand, helpCommand.validInputExample), helpCommand.validInputExample);
  assert.deepEqual(issueGetHelp.required_options.map((option) => option.input_key), ['issue_number']);
  assert.deepEqual(issueGetHelp.optional_options.map((option) => option.input_key), ['repo', 'config', 'auth_config']);
  assert.deepEqual(issueValidateHelp.requirements, {
    caller_context: 'not_required',
    repo_local_config: 'required',
    machine_local_auth_config: 'not_required',
    github_access: 'not_required',
  });
});

test('help command success data rejects unknown canonical command names', () => {
  assert.throws(() => createHelpCommandSuccessData(COMMANDS, 'issue unknown'), /Unknown command "issue unknown"\./);
});
