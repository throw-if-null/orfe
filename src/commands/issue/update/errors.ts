import { OrfeError } from '../../../errors.js';
import type { CommandInput } from '../../../types.js';

export function validateIssueUpdateInput(input: CommandInput): CommandInput {
  if (
    input.title === undefined &&
    input.body === undefined &&
    input.labels === undefined &&
    input.assignees === undefined &&
    input.clear_labels !== true &&
    input.clear_assignees !== true
  ) {
    throw new OrfeError('invalid_usage', 'issue update requires at least one mutation option.');
  }

  if (input.labels !== undefined && input.clear_labels === true) {
    throw new OrfeError('invalid_usage', 'issue update does not allow labels together with --clear-labels.');
  }

  if (input.assignees !== undefined && input.clear_assignees === true) {
    throw new OrfeError('invalid_usage', 'issue update does not allow assignees together with --clear-assignees.');
  }

  return input;
}
