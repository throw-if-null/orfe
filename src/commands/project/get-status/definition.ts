import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handleProjectGetStatus } from './handler.js';

export const projectGetStatusCommand = createCommandDefinition({
  name: 'project get-status',
  purpose: 'Read the current Status field value for a project item.',
  usage:
    'orfe project get-status --item-type <issue|pr> --item-number <number> [--project-owner <login>] [--project-number <number>] [--status-field-name <name>] [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints a structured JSON project status payload.',
  examples: ['ORFE_CALLER_NAME=Greg orfe project get-status --item-type issue --item-number 14'],
  options: [
    { key: 'item_type', flag: '--item-type', description: 'Item type.', type: 'enum', enumValues: ['issue', 'pr'], required: true },
    { key: 'item_number', flag: '--item-number', description: 'Item number.', type: 'number', required: true },
    { key: 'project_owner', flag: '--project-owner', description: 'Project owner.', type: 'string' },
    { key: 'project_number', flag: '--project-number', description: 'Project number.', type: 'number' },
    { key: 'status_field_name', flag: '--status-field-name', description: 'Status field name.', type: 'string' },
    createRepoOption(),
  ],
  validInputExample: { item_type: 'issue', item_number: 13 },
  successDataExample: {
    project_owner: 'throw-if-null',
    project_number: 1,
    status_field_name: 'Status',
    status_field_id: 'PVTSSF_lAHOABCD1234',
    item_type: 'issue',
    item_number: 13,
    project_item_id: 'PVTI_lAHOABCD1234',
    status_option_id: 'f75ad846',
    status: 'In Progress',
  },
  handler: handleProjectGetStatus,
});
