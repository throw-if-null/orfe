import type { CommandInput } from '../../../core/types.js';
import { readPullRequestReviewEvent } from '../shared/review.js';

export function validatePrSubmitReviewInput(input: CommandInput): CommandInput {
  readPullRequestReviewEvent(input.event);
  return input;
}
