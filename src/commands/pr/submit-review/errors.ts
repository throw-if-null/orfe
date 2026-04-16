import { OrfeError } from '../../../errors.js';
import type { CommandInput } from '../../../types.js';
import type { PullRequestReviewEvent } from '../shared.js';

export function validatePrSubmitReviewInput(input: CommandInput): CommandInput {
  readPullRequestReviewEvent(input.event);
  return input;
}

export function readPullRequestReviewEvent(value: unknown): PullRequestReviewEvent {
  if (value === 'approve' || value === 'request-changes' || value === 'comment') {
    return value;
  }

  throw new OrfeError('invalid_input', 'Review event must be one of: approve, request-changes, comment.');
}
