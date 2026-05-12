export type {
  ArtifactTemplateValidationResult,
  BodyValidationIssue,
  BodyValidationIssueKind,
  BodyValidationIssueScope,
  PreparedArtifactBody,
  TemplateArtifactType,
  TemplateDefinition,
  TemplateFieldDefinition,
  TemplateRef,
  TemplateSectionDefinition,
  TemplateSource,
} from './types.js';
export { loadTemplate } from './loader.js';
export { extractTemplateProvenance, renderBodyWithTemplateProvenance, renderTemplateProvenance, stripTemplateProvenance } from './provenance.js';
export { prepareArtifactBody, validateArtifactBody } from './prepare.js';
export { validateBodyAgainstTemplate, validateBodyAgainstTemplateDetailed } from './body-validator.js';
