export interface IssueCreateProjectAssignmentData {
  project_owner: string;
  project_number: number;
  project_item_id: string;
  status_field_name?: string;
  status_option_id?: string | null;
  status?: string | null;
}

export interface IssueCreateData {
  issue_number: number;
  title: string;
  state: string;
  html_url: string;
  created: true;
  project_assignment?: IssueCreateProjectAssignmentData;
}
