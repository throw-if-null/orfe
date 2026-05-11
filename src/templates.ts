import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OrfeError } from './errors.js';
import { findUp } from './path.js';
import type { RepoLocalConfig } from './types.js';

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

interface ParsedBodySection {
  heading: string;
  content: string;
}

interface ParsedBodyStructure {
  preamble: string;
  sections: ParsedBodySection[];
}

interface TemplateResolutionResult {
  template?: TemplateRef;
  templateSource?: TemplateSource;
  issues: BodyValidationIssue[];
}

const TEMPLATE_SELECTION_PATTERN = /^(?:(issue|pr)\/)?([a-z0-9][a-z0-9-]*)@([A-Za-z0-9._-]+)$/;
const PROVENANCE_PATTERN_SOURCE = '<!--\\s*orfe-template:\\s*(issue|pr)\\/([a-z0-9][a-z0-9-]*)@([A-Za-z0-9._-]+)\\s*-->';
const TOP_LEVEL_SECTION_PATTERN = /^##\s+(.+?)\s*$/;

export async function prepareArtifactBody(options: {
  artifactType: TemplateArtifactType;
  body?: string;
  template?: string;
  repoConfig: RepoLocalConfig;
}): Promise<PreparedArtifactBody | undefined> {
  if (options.body === undefined) {
    if (options.template !== undefined) {
      throw new OrfeError('invalid_usage', 'template requires body in this runtime slice.');
    }

    return undefined;
  }

  const templateResolution = resolveTemplateSelection({
    artifactType: options.artifactType,
    body: options.body,
    ...(typeof options.template === 'string' ? { template: options.template } : {}),
  });

  if (templateResolution.issues.length > 0) {
    throwFirstValidationIssue(templateResolution.issues);
  }

  if (!templateResolution.template) {
    return undefined;
  }

  const template = await loadTemplate(options.repoConfig, templateResolution.template);
  const bodyWithoutMarker = stripTemplateProvenance(options.body);
  const validationResult = validateBodyAgainstTemplateDetailed(bodyWithoutMarker, template);

  if (!validationResult.valid) {
    throwFirstValidationIssue(validationResult.errors);
  }

  return {
    body: renderBodyWithTemplateProvenance(bodyWithoutMarker, template),
    template: toTemplateRef(template),
  };
}

export async function validateArtifactBody(options: {
  artifactType: TemplateArtifactType;
  body: string;
  template?: string;
  repoConfig: RepoLocalConfig;
}): Promise<ArtifactTemplateValidationResult> {
  const templateResolution = resolveTemplateSelection({
    artifactType: options.artifactType,
    body: options.body,
    ...(typeof options.template === 'string' ? { template: options.template } : {}),
    requireTemplate: true,
  });

  if (templateResolution.issues.length > 0 || !templateResolution.template) {
    return {
      valid: false,
      ...(templateResolution.template ? { template: templateResolution.template } : {}),
      ...(templateResolution.templateSource ? { template_source: templateResolution.templateSource } : {}),
      errors: templateResolution.issues,
    };
  }

  const template = await loadTemplate(options.repoConfig, templateResolution.template);
  const bodyWithoutMarker = stripTemplateProvenance(options.body);
  const validationResult = validateBodyAgainstTemplateDetailed(bodyWithoutMarker, template);

  return {
    valid: validationResult.valid,
    template: toTemplateRef(template),
    ...(templateResolution.templateSource ? { template_source: templateResolution.templateSource } : {}),
    ...(validationResult.valid ? { normalized_body: renderBodyWithTemplateProvenance(bodyWithoutMarker, template) } : {}),
    errors: validationResult.errors,
  };
}

export async function loadTemplate(config: RepoLocalConfig, ref: TemplateRef): Promise<TemplateDefinition> {
  const templatesRoot = await resolveTemplatesRoot(config.configPath);
  const templatePath = path.join(
    templatesRoot,
    ref.artifact_type === 'issue' ? 'issues' : 'pr',
    ref.template_name,
    `${ref.template_version}.json`,
  );

  let rawContents: string;

  try {
    rawContents = await readFile(templatePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new OrfeError('template_not_found', `Template ${formatTemplateRef(ref)} was not found at ${templatePath}.`);
    }

    throw new OrfeError('template_invalid', `Unable to read template ${formatTemplateRef(ref)} at ${templatePath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContents) as unknown;
  } catch {
    throw new OrfeError('template_invalid', `Template ${formatTemplateRef(ref)} at ${templatePath} is not valid JSON.`);
  }

  return validateTemplateDefinition(parsed, templatePath, ref.artifact_type);
}

export function extractTemplateProvenance(body: string): TemplateRef | undefined {
  const provenance = inspectTemplateProvenance(body);

  if (provenance.issues.length > 0) {
    throwFirstValidationIssue(provenance.issues);
  }

  return provenance.template;
}

export function stripTemplateProvenance(body: string): string {
  return body.replace(new RegExp(PROVENANCE_PATTERN_SOURCE, 'g'), '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function renderTemplateProvenance(ref: TemplateRef): string {
  return `<!-- orfe-template: ${formatTemplateRef(ref)} -->`;
}

export function renderBodyWithTemplateProvenance(body: string, ref: TemplateRef): string {
  const marker = renderTemplateProvenance(ref);
  const strippedBody = stripTemplateProvenance(body);

  if (strippedBody.trim().length === 0) {
    return marker;
  }

  return `${strippedBody.trimEnd()}\n\n${marker}`;
}

export function validateBodyAgainstTemplate(body: string, template: TemplateDefinition): void {
  const validationResult = validateBodyAgainstTemplateDetailed(body, template);

  if (!validationResult.valid) {
    throwFirstValidationIssue(validationResult.errors);
  }
}

export function validateBodyAgainstTemplateDetailed(
  body: string,
  template: TemplateDefinition,
): Pick<ArtifactTemplateValidationResult, 'valid' | 'errors'> {
  const parsedBody = parseBodyStructure(body);
  const issues: BodyValidationIssue[] = [];

  issues.push(...collectPatternIssues(parsedBody.preamble, template.preamble_required_patterns, { scope: 'preamble' }, 'required'));
  issues.push(...collectPatternIssues(parsedBody.preamble, template.preamble_forbidden_patterns, { scope: 'preamble' }, 'forbidden'));
  issues.push(...collectPatternIssues(body, template.required_patterns, { scope: 'body' }, 'required'));
  issues.push(...collectPatternIssues(body, template.forbidden_patterns, { scope: 'body' }, 'forbidden'));

  const sectionsByHeading = new Map<string, ParsedBodySection>();
  for (const section of parsedBody.sections) {
    if (sectionsByHeading.has(section.heading)) {
      issues.push({
        kind: 'duplicate_section_heading',
        scope: 'section',
        section_heading: section.heading,
        message: `Template validation failed: duplicate section heading "${section.heading}".`,
      });

      continue;
    }

    sectionsByHeading.set(section.heading, section);
  }

  if (template.allow_additional_sections === false) {
    const allowedHeadings = new Set(template.sections.map((section) => section.heading));

    for (const section of parsedBody.sections) {
      if (!allowedHeadings.has(section.heading)) {
        issues.push({
          kind: 'section_not_allowed',
          scope: 'section',
          section_heading: section.heading,
          message: `Template validation failed: section "${section.heading}" is not allowed by ${formatTemplateRef(template)}.`,
        });
      }
    }
  }

  for (const sectionDefinition of template.sections) {
    const parsedSection = sectionsByHeading.get(sectionDefinition.heading);

    if (!parsedSection) {
      if (sectionDefinition.required !== false) {
        issues.push({
          kind: 'missing_required_section',
          scope: 'section',
          section_heading: sectionDefinition.heading,
          message: `Template validation failed: missing required section "${sectionDefinition.heading}".`,
        });
      }

      continue;
    }

    if (sectionDefinition.allow_empty !== true && parsedSection.content.trim().length === 0) {
      issues.push({
        kind: 'empty_section',
        scope: 'section',
        section_heading: sectionDefinition.heading,
        message: `Template validation failed: section "${sectionDefinition.heading}" must not be empty.`,
      });
    }

    issues.push(
      ...collectPatternIssues(
        parsedSection.content,
        sectionDefinition.required_patterns,
        { scope: 'section', section_heading: sectionDefinition.heading },
        'required',
      ),
    );
    issues.push(
      ...collectPatternIssues(
        parsedSection.content,
        sectionDefinition.forbidden_patterns,
        { scope: 'section', section_heading: sectionDefinition.heading },
        'forbidden',
      ),
    );

    for (const fieldDefinition of sectionDefinition.fields ?? []) {
      issues.push(...validateSectionFieldDetailed(parsedSection, fieldDefinition, template));
    }
  }

  return {
    valid: issues.length === 0,
    errors: issues,
  };
}

function parseTemplateSelection(selection: string, expectedArtifactType: TemplateArtifactType): TemplateRef {
  const match = TEMPLATE_SELECTION_PATTERN.exec(selection.trim());
  if (!match) {
    throw new OrfeError('invalid_usage', `template must be in "<name>@<version>" format. Received "${selection}".`);
  }

  const selectionArtifactType = (match[1] as TemplateArtifactType | undefined) ?? expectedArtifactType;
  if (selectionArtifactType !== expectedArtifactType) {
    throw new OrfeError('invalid_usage', `template ${selection} targets ${selectionArtifactType}, but this command validates ${expectedArtifactType} bodies.`);
  }

  return {
    artifact_type: selectionArtifactType,
    template_name: match[2]!,
    template_version: match[3]!,
  };
}

function parseBodyStructure(body: string): ParsedBodyStructure {
  const lines = body.split(/\r?\n/);
  const sections: ParsedBodySection[] = [];
  const preambleLines: string[] = [];
  let currentSectionHeading: string | undefined;
  let currentSectionLines: string[] = [];

  for (const line of lines) {
    const headingMatch = TOP_LEVEL_SECTION_PATTERN.exec(line);

    if (headingMatch) {
      if (currentSectionHeading) {
        sections.push({
          heading: currentSectionHeading,
          content: currentSectionLines.join('\n').trim(),
        });
      }

      currentSectionHeading = headingMatch[1]!;
      currentSectionLines = [];
      continue;
    }

    if (currentSectionHeading) {
      currentSectionLines.push(line);
    } else {
      preambleLines.push(line);
    }
  }

  if (currentSectionHeading) {
    sections.push({
      heading: currentSectionHeading,
      content: currentSectionLines.join('\n').trim(),
    });
  }

  return {
    preamble: preambleLines.join('\n').trim(),
    sections,
  };
}

function validateSectionFieldDetailed(
  parsedSection: ParsedBodySection,
  fieldDefinition: TemplateFieldDefinition,
  template: TemplateDefinition,
): BodyValidationIssue[] {
  const fieldPattern = new RegExp(`^\\s*-\\s*${escapeRegExp(fieldDefinition.label)}:\\s*(.+?)\\s*$`, 'gm');
  const matches = [...parsedSection.content.matchAll(fieldPattern)].map((match) => match[1]!.trim());
  const issues: BodyValidationIssue[] = [];

  if (matches.length === 0) {
    if (fieldDefinition.required !== false) {
      issues.push({
        kind: 'missing_required_field',
        scope: 'field',
        section_heading: parsedSection.heading,
        field_label: fieldDefinition.label,
        message: `Template validation failed: missing required field "${fieldDefinition.label}" in section "${parsedSection.heading}" for ${formatTemplateRef(template)}.`,
      });
    }

    return issues;
  }

  if (matches.length > 1) {
    issues.push({
      kind: 'duplicate_field',
      scope: 'field',
      section_heading: parsedSection.heading,
      field_label: fieldDefinition.label,
      message: `Template validation failed: field "${fieldDefinition.label}" appears multiple times in section "${parsedSection.heading}".`,
    });

    return issues;
  }

  const fieldValue = matches[0];
  if (!fieldValue || fieldValue.length === 0) {
    issues.push({
      kind: 'empty_field',
      scope: 'field',
      section_heading: parsedSection.heading,
      field_label: fieldDefinition.label,
      message: `Template validation failed: field "${fieldDefinition.label}" in section "${parsedSection.heading}" must not be empty.`,
    });

    return issues;
  }

  if (fieldDefinition.allowed_values && !fieldDefinition.allowed_values.includes(fieldValue)) {
    issues.push({
      kind: 'invalid_allowed_value',
      scope: 'field',
      section_heading: parsedSection.heading,
      field_label: fieldDefinition.label,
      expected_values: [...fieldDefinition.allowed_values],
      actual_value: fieldValue,
      message: `Template validation failed: field "${fieldDefinition.label}" in section "${parsedSection.heading}" must be one of ${fieldDefinition.allowed_values.join(', ')}.`,
    });
  }

  return issues;
}

function collectPatternIssues(
  value: string,
  patterns: string[] | undefined,
  context: Pick<BodyValidationIssue, 'scope' | 'section_heading'>,
  mode: 'required' | 'forbidden',
): BodyValidationIssue[] {
  const issues: BodyValidationIssue[] = [];

  for (const pattern of patterns ?? []) {
    const regex = createTemplatePattern(pattern, context.scope);
    const matched = regex.test(value);

    if (mode === 'required' && !matched) {
      issues.push({
        kind: 'missing_required_pattern',
        ...context,
        pattern,
        message: `Template validation failed: ${formatValidationScope(context)} is missing required pattern ${pattern}.`,
      });
    }

    if (mode === 'forbidden' && matched) {
      issues.push({
        kind: 'matched_forbidden_pattern',
        ...context,
        pattern,
        message: `Template validation failed: ${formatValidationScope(context)} matched forbidden pattern ${pattern}.`,
      });
    }
  }

  return issues;
}

function resolveTemplateSelection(options: {
  artifactType: TemplateArtifactType;
  body: string;
  template?: string;
  requireTemplate?: boolean;
}): TemplateResolutionResult {
  const explicitTemplate = typeof options.template === 'string' ? parseTemplateSelection(options.template, options.artifactType) : undefined;
  const provenance = inspectTemplateProvenance(options.body);
  const markerTemplate = provenance.template;
  const issues = [...provenance.issues];

  if (markerTemplate && markerTemplate.artifact_type !== options.artifactType) {
    issues.push({
      kind: 'provenance_artifact_type_mismatch',
      scope: 'provenance',
      message: `Artifact body provenance ${formatTemplateRef(markerTemplate)} does not match ${options.artifactType} body validation.`,
    });
  }

  if (explicitTemplate && markerTemplate) {
    if (
      explicitTemplate.artifact_type !== markerTemplate.artifact_type ||
      explicitTemplate.template_name !== markerTemplate.template_name ||
      explicitTemplate.template_version !== markerTemplate.template_version
    ) {
      issues.push({
        kind: 'template_provenance_mismatch',
        scope: 'provenance',
        message: `Explicit template ${formatTemplateRef(explicitTemplate)} does not match provenance marker ${formatTemplateRef(markerTemplate)}.`,
      });
    }
  }

  if (issues.length > 0) {
    return {
      ...(explicitTemplate && markerTemplate ? { templateSource: 'explicit-and-provenance' as const } : {}),
      issues,
    };
  }

  if (explicitTemplate && markerTemplate) {
    return {
      template: explicitTemplate,
      templateSource: 'explicit-and-provenance',
      issues,
    };
  }

  if (explicitTemplate) {
    return {
      template: explicitTemplate,
      templateSource: 'explicit',
      issues,
    };
  }

  if (markerTemplate) {
    return {
      template: markerTemplate,
      templateSource: 'provenance',
      issues,
    };
  }

  if (options.requireTemplate === true) {
    issues.push({
      kind: 'template_selection_required',
      scope: 'provenance',
      message: 'Body validation requires template or an existing template provenance marker.',
    });
  }

  return { issues };
}

function inspectTemplateProvenance(body: string): Pick<TemplateResolutionResult, 'template' | 'issues'> {
  const matches = [...body.matchAll(new RegExp(PROVENANCE_PATTERN_SOURCE, 'g'))];

  if (matches.length === 0) {
    return { issues: [] };
  }

  if (matches.length > 1) {
    return {
      issues: [
        {
          kind: 'multiple_provenance_markers',
          scope: 'provenance',
          message: 'Artifact body contains multiple template provenance markers.',
        },
      ],
    };
  }

  const match = matches[0];
  if (!match) {
    return { issues: [] };
  }

  return {
    template: {
      artifact_type: match[1] as TemplateArtifactType,
      template_name: match[2]!,
      template_version: match[3]!,
    },
    issues: [],
  };
}

function formatValidationScope(context: Pick<BodyValidationIssue, 'scope' | 'section_heading'>): string {
  if (context.scope === 'section' && context.section_heading) {
    return `section "${context.section_heading}"`;
  }

  return context.scope;
}

function throwFirstValidationIssue(issues: BodyValidationIssue[]): never {
  throw new OrfeError('template_validation_failed', issues[0]?.message ?? 'Template validation failed.');
}

function createTemplatePattern(pattern: string, label: string): RegExp {
  try {
    return new RegExp(pattern, 'm');
  } catch {
    throw new OrfeError('template_invalid', `Template ${label} contains invalid regex pattern "${pattern}".`);
  }
}

async function resolveTemplatesRoot(configPath: string): Promise<string> {
  const configDirectory = path.dirname(configPath);

  if (path.basename(configDirectory) === '.orfe') {
    return path.join(configDirectory, 'templates');
  }

  const canonicalConfigPath = await findUp(configDirectory, '.orfe/config.json');
  if (canonicalConfigPath) {
    return path.join(path.dirname(canonicalConfigPath), 'templates');
  }

  const sourceRelativeTemplatesRoot = await findUp(path.dirname(fileURLToPath(import.meta.url)), '.orfe/templates');
  if (sourceRelativeTemplatesRoot) {
    return sourceRelativeTemplatesRoot;
  }

  const runtimeTemplatesRoot = await findUp(process.cwd(), '.orfe/templates');
  if (runtimeTemplatesRoot) {
    return runtimeTemplatesRoot;
  }

  return path.join(configDirectory, '.orfe', 'templates');
}

function validateTemplateDefinition(
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

function toTemplateRef(template: TemplateRef): TemplateRef {
  return {
    artifact_type: template.artifact_type,
    template_name: template.template_name,
    template_version: template.template_version,
  };
}

function formatTemplateRef(ref: TemplateRef): string {
  return `${ref.artifact_type}/${ref.template_name}@${ref.template_version}`;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
