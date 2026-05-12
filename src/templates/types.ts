export type TemplateArtifactType = 'issue' | 'pr';

export interface TemplateRef {
  artifact_type: TemplateArtifactType;
  template_name: string;
  template_version: string;
}

export interface TemplateFieldDefinition {
  key: string;
  label: string;
  required?: boolean;
  allowed_values?: string[];
}

export interface TemplateSectionDefinition {
  id: string;
  heading: string;
  required?: boolean;
  allow_empty?: boolean;
  required_patterns?: string[];
  forbidden_patterns?: string[];
  fields?: TemplateFieldDefinition[];
}

export interface TemplateDefinition extends TemplateRef {
  schema_version: 1;
  description?: string;
  allow_additional_sections?: boolean;
  preamble_required_patterns?: string[];
  preamble_forbidden_patterns?: string[];
  required_patterns?: string[];
  forbidden_patterns?: string[];
  sections: TemplateSectionDefinition[];
}

export interface PreparedArtifactBody {
  body: string;
  template: TemplateRef;
}

export type TemplateSource = 'explicit' | 'provenance' | 'explicit-and-provenance';

export type BodyValidationIssueScope = 'provenance' | 'preamble' | 'body' | 'section' | 'field';

export type BodyValidationIssueKind =
  | 'template_selection_required'
  | 'multiple_provenance_markers'
  | 'provenance_artifact_type_mismatch'
  | 'template_provenance_mismatch'
  | 'missing_required_pattern'
  | 'matched_forbidden_pattern'
  | 'duplicate_section_heading'
  | 'section_not_allowed'
  | 'missing_required_section'
  | 'empty_section'
  | 'missing_required_field'
  | 'duplicate_field'
  | 'empty_field'
  | 'invalid_allowed_value';

export interface BodyValidationIssue {
  kind: BodyValidationIssueKind;
  scope: BodyValidationIssueScope;
  message: string;
  pattern?: string;
  section_heading?: string;
  field_label?: string;
  expected_values?: string[];
  actual_value?: string;
}

export interface ArtifactTemplateValidationResult {
  valid: boolean;
  template?: TemplateRef;
  template_source?: TemplateSource;
  normalized_body?: string;
  errors: BodyValidationIssue[];
}
