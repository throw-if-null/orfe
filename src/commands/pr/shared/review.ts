import { OrfeError } from '../../../runtime/errors.js';

export type PullRequestReviewEvent = 'approve' | 'request-changes' | 'comment';

export function readPullRequestReviewEvent(value: unknown): PullRequestReviewEvent {
  if (value === 'approve' || value === 'request-changes' || value === 'comment') {
    return value;
  }

  throw new OrfeError('invalid_input', 'Review event must be one of: approve, request-changes, comment.');
}

export function mapPullRequestReviewEvent(value: PullRequestReviewEvent): 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' {
  switch (value) {
    case 'approve':
      return 'APPROVE';
    case 'request-changes':
      return 'REQUEST_CHANGES';
    case 'comment':
      return 'COMMENT';
  }
}
