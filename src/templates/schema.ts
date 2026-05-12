import { OrfeError } from '../errors.js';
import type { TemplateArtifactType, TemplateDefinition, TemplateFieldDefinition, TemplateSectionDefinition } from './types.js';

export function validateTemplateDefinition(
  value: unknown,
  templatePath: string,
  expectedArtifactType: TemplateArtifactType,
): TemplateDefinition {
  const template = expectObject(value, templatePath);
  const schemaVersion = expectLiteralNumber(template.schema_version, 1, `${templatePath}: schema_version`);
  const artifactType = expectArtifactType(template.artifact_type, `${templatePath}: artifact_type`);

  if (artifactType !== expectedArtifactType) {
    throw new OrfeError(
      'template_invalid',
      `Template ${templatePath} declares artifact_type "${artifactType}", expected "${expectedArtifactType}".`,
    );
  }

  const templateName = expectNonEmptyString(template.template_name, `${templatePath}: template_name`);
  const templateVersion = expectNonEmptyString(template.template_version, `${templatePath}: template_version`);
  const sections = expectArray(template.sections, `${templatePath}: sections`).map((entry, index) =>
    validateTemplateSection(entry, `${templatePath}: sections[${index}]`),
  );

  const validatedTemplate: TemplateDefinition = {
    schema_version: schemaVersion,
    artifact_type: artifactType,
    template_name: templateName,
    template_version: templateVersion,
    sections,
  };

  if (template.description !== undefined) {
    validatedTemplate.description = expectNonEmptyString(template.description, `${templatePath}: description`);
  }

  if (template.allow_additional_sections !== undefined) {
    validatedTemplate.allow_additional_sections = expectBoolean(template.allow_additional_sections, `${templatePath}: allow_additional_sections`);
  }

  assignPatternArray(template, validatedTemplate, templatePath, 'preamble_required_patterns');
  assignPatternArray(template, validatedTemplate, templatePath, 'preamble_forbidden_patterns');
  assignPatternArray(template, validatedTemplate, templatePath, 'required_patterns');
  assignPatternArray(template, validatedTemplate, templatePath, 'forbidden_patterns');

  return validatedTemplate;
}

function validateTemplateSection(value: unknown, label: string): TemplateSectionDefinition {
  const section = expectObject(value, label);
  const validatedSection: TemplateSectionDefinition = {
    id: expectNonEmptyString(section.id, `${label}: id`),
    heading: expectNonEmptyString(section.heading, `${label}: heading`),
  };

  if (section.required !== undefined) {
    validatedSection.required = expectBoolean(section.required, `${label}: required`);
  }

  if (section.allow_empty !== undefined) {
    validatedSection.allow_empty = expectBoolean(section.allow_empty, `${label}: allow_empty`);
  }

  assignPatternArray(section, validatedSection, label, 'required_patterns');
  assignPatternArray(section, validatedSection, label, 'forbidden_patterns');

  if (section.fields !== undefined) {
    validatedSection.fields = expectArray(section.fields, `${label}: fields`).map((entry, index) =>
      validateTemplateField(entry, `${label}: fields[${index}]`),
    );
  }

  return validatedSection;
}

function validateTemplateField(value: unknown, label: string): TemplateFieldDefinition {
  const field = expectObject(value, label);
  const validatedField: TemplateFieldDefinition = {
    key: expectNonEmptyString(field.key, `${label}: key`),
    label: expectNonEmptyString(field.label, `${label}: label`),
  };

  if (field.required !== undefined) {
    validatedField.required = expectBoolean(field.required, `${label}: required`);
  }

  if (field.allowed_values !== undefined) {
    validatedField.allowed_values = expectArray(field.allowed_values, `${label}: allowed_values`).map((entry, index) =>
      expectNonEmptyString(entry, `${label}: allowed_values[${index}]`),
    );
  }

  return validatedField;
}

function assignPatternArray<
  TTarget extends Partial<
    Pick<TemplateDefinition, 'preamble_required_patterns' | 'preamble_forbidden_patterns' | 'required_patterns' | 'forbidden_patterns'> &
      Pick<TemplateSectionDefinition, 'required_patterns' | 'forbidden_patterns'>
  >,
>(
  source: Record<string, unknown>,
  target: TTarget,
  label: string,
  key: 'preamble_required_patterns' | 'preamble_forbidden_patterns' | 'required_patterns' | 'forbidden_patterns',
): void {
  if (source[key] === undefined) {
    return;
  }

  const patterns = expectArray(source[key], `${label}: ${key}`).map((entry, index) =>
    expectNonEmptyString(entry, `${label}: ${key}[${index}]`),
  );

  for (const pattern of patterns) {
    createTemplatePattern(pattern, `${label}: ${key}`);
  }

  target[key] = patterns;
}

function createTemplatePattern(pattern: string, label: string): RegExp {
  try {
    return new RegExp(pattern, 'm');
  } catch {
    throw new OrfeError('template_invalid', `Template ${label} contains invalid regex pattern "${pattern}".`);
  }
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new OrfeError('template_invalid', `${label} must be an object.`);
  }

  return value;
}

function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new OrfeError('template_invalid', `${label} must be an array.`);
  }

  return value;
}

function expectNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OrfeError('template_invalid', `${label} must be a non-empty string.`);
  }

  return value;
}

function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new OrfeError('template_invalid', `${label} must be a boolean.`);
  }

  return value;
}

function expectLiteralNumber(value: unknown, expected: 1, label: string): 1 {
  if (value !== expected) {
    throw new OrfeError('template_invalid', `${label} must be ${expected}.`);
  }

  return expected;
}

function expectArtifactType(value: unknown, label: string): TemplateArtifactType {
  if (value === 'issue' || value === 'pr') {
    return value;
  }

  throw new OrfeError('template_invalid', `${label} must be "issue" or "pr".`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
