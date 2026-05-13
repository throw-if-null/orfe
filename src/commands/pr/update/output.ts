export interface PullRequestUpdateData {
  pr_number: number;
  title: string;
  html_url: string;
  head: string;
  base: string;
  draft: boolean;
  changed: true;
}
