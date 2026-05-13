import { OrfeError } from '../../../runtime/errors.js';
import type { CommandInput } from '../../../core/types.js';

export function validateIssueSetStateInput(input: CommandInput): CommandInput {
  if (input.state_reason !== undefined && input.state !== 'closed') {
    throw new OrfeError('invalid_usage', 'issue set-state only allows state_reason when --state closed is used.');
  }

  if (input.duplicate_of !== undefined && input.state_reason !== 'duplicate') {
    throw new OrfeError('invalid_usage', 'issue set-state only allows duplicate_of with state_reason=duplicate.');
  }

  if (input.state_reason === 'duplicate' && input.duplicate_of === undefined) {
    throw new OrfeError('invalid_usage', 'issue set-state requires --duplicate-of when state_reason=duplicate.');
  }

  if (input.duplicate_of !== undefined && input.duplicate_of === input.issue_number) {
    throw new OrfeError('invalid_usage', 'issue set-state cannot mark an issue as a duplicate of itself.');
  }

  return input;
}
