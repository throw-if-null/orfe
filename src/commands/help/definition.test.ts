import assert from 'node:assert/strict';
import test from 'node:test';

import { helpCommand } from '../index.js';

test('help slice owns its command metadata and contract examples', () => {
  assert.equal(helpCommand.name, 'help');
  assert.equal(helpCommand.group, 'help');
  assert.equal(helpCommand.leaf, 'help');
  assert.equal(helpCommand.topLevel, true);
  assert.deepEqual(helpCommand.validInputExample, { command_name: 'issue get' });
  assert.deepEqual(helpCommand.successDataExample, {
    scope: 'command',
    canonical_command_name: 'issue get',
    purpose: 'Read one issue.',
    usage: {
      cli: 'orfe issue get --issue-number <number> [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
      tool_input: {
        command: 'issue get',
        issue_number: 13,
      },
    },
    required_options: [
      {
        input_key: 'issue_number',
        cli_flag: '--issue-number',
        description: 'Issue number.',
        type: 'number',
        required: true,
      },
    ],
    optional_options: [
      {
        input_key: 'repo',
        cli_flag: '--repo',
        description: 'Override the target repository as owner/name.',
        type: 'string',
        required: false,
      },
    ],
    examples: [
      {
        cli: 'ORFE_CALLER_NAME=Greg orfe issue get --issue-number 14',
      },
      {
        tool_input: {
          command: 'issue get',
          issue_number: 13,
        },
      },
    ],
    success_output_summary: 'Prints a structured JSON issue payload.',
    success_data_example: {
      issue_number: 13,
      title: 'Design the `orfe` custom tool and CLI contract',
      body: '...',
      state: 'open',
      state_reason: null,
      labels: ['needs-input'],
      assignees: ['greg'],
      html_url: 'https://github.com/throw-if-null/orfe/issues/13',
    },
    caller_context_required: true,
  });
});
