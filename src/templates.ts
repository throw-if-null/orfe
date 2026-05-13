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
} from './templates/types.js';
export { loadTemplate } from './templates/loader.js';
export { throwFirstValidationIssue } from './templates/errors.js';
export { formatTemplateRef } from './templates/formatters.js';
export {
  extractTemplateProvenance,
  renderBodyWithTemplateProvenance,
  renderTemplateProvenance,
  stripTemplateProvenance,
} from './templates/provenance.js';
export { prepareIssueBodyFromInput, preparePullRequestBodyFromInput } from './templates/body-input.js';
export { prepareArtifactBody, validateArtifactBody } from './templates/prepare.js';
export { validateBodyAgainstTemplate, validateBodyAgainstTemplateDetailed } from './templates/body-validator.js';
