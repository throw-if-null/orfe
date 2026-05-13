export interface PullRequestGetOrCreateData {
  pr_number: number;
  html_url: string;
  head: string;
  base: string;
  draft: boolean;
  created: boolean;
}
