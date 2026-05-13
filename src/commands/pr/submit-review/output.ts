import type { PullRequestReviewEvent } from '../shared/review.js';

export interface PullRequestSubmitReviewData {
  pr_number: number;
  review_id: number;
  event: PullRequestReviewEvent;
  submitted: true;
}
