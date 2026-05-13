export interface ProjectSetStatusData {
  project_owner: string;
  project_number: number;
  status_field_name: string;
  status_field_id: string;
  item_type: 'issue' | 'pr';
  item_number: number;
  project_item_id: string;
  status_option_id: string;
  status: string;
  previous_status_option_id: string | null;
  previous_status: string | null;
  changed: boolean;
}
