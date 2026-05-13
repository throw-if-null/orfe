export interface PullRequestGetData {
  pr_number: number;
  title: string;
  body: string;
  state: string;
  draft: boolean;
  head: string;
  base: string;
  html_url: string;
}
