import { OrfeError } from '../errors.js';
import type { RepoLocalConfig } from '../types.js';
import { validateBodyAgainstTemplateDetailed } from './body-validator.js';
import { throwFirstValidationIssue } from './errors.js';
import { loadTemplate } from './loader.js';
import { renderBodyWithTemplateProvenance, stripTemplateProvenance } from './provenance.js';
import { resolveTemplateSelection } from './selector.js';
import type { ArtifactTemplateValidationResult, PreparedArtifactBody, TemplateArtifactType, TemplateRef } from './types.js';

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

function toTemplateRef(template: TemplateRef): TemplateRef {
  return {
    artifact_type: template.artifact_type,
    template_name: template.template_name,
    template_version: template.template_version,
  };
}
