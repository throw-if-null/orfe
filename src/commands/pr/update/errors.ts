import { OrfeError } from '../../../errors.js';
import type { CommandInput } from '../../../types.js';

export function validatePrUpdateInput(input: CommandInput): CommandInput {
  if (input.body_contract !== undefined && input.body === undefined) {
    throw new OrfeError('invalid_usage', 'pr update only allows body_contract together with --body.');
  }

  if (input.title === undefined && input.body === undefined) {
    throw new OrfeError('invalid_usage', 'pr update requires at least one mutation option.');
  }

  return input;
}
