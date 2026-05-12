import { OrfeError } from '../errors.js';
import { formatTemplateRef } from './formatters.js';
import { inspectTemplateProvenance } from './provenance.js';
import type { BodyValidationIssue, TemplateArtifactType, TemplateRef, TemplateSource } from './types.js';

const TEMPLATE_SELECTION_PATTERN = /^(?:(issue|pr)\/)?([a-z0-9][a-z0-9-]*)@([A-Za-z0-9._-]+)$/;

export interface TemplateResolutionResult {
  template?: TemplateRef;
  templateSource?: TemplateSource;
  issues: BodyValidationIssue[];
}

export function parseTemplateSelection(selection: string, expectedArtifactType: TemplateArtifactType): TemplateRef {
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

export function resolveTemplateSelection(options: {
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
