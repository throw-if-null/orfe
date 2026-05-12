import { OrfeError } from '../errors.js';
import { parseBodyStructure, type ParsedBodySection } from './body-parser.js';
import type { ArtifactTemplateValidationResult, BodyValidationIssue, TemplateDefinition, TemplateFieldDefinition, TemplateRef } from './types.js';

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

function formatTemplateRef(ref: TemplateRef): string {
  return `${ref.artifact_type}/${ref.template_name}@${ref.template_version}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
