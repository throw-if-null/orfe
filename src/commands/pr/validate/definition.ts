import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handlePrValidate } from './handler.js';

export const prValidateCommand = createCommandDefinition({
  name: 'pr validate',
  purpose: 'Validate a pull request body against a versioned template.',
  usage:
    'orfe pr validate --body <text> [--template <name@version>] [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints structured PR body template validation results.',
  examples: [
    'ORFE_CALLER_NAME=Greg orfe pr validate --body "Ref: #58\n\n## Summary\n- ..." --template implementation-ready@1.0.0',
    'ORFE_CALLER_NAME=Greg orfe pr validate --body "Ref: #58\n\n## Summary\n- ...\n\n<!-- orfe-template: pr/implementation-ready@1.0.0 -->"',
  ],
  options: [
    { key: 'body', flag: '--body', description: 'Pull request body to validate.', type: 'string', required: true },
    {
      key: 'template',
      flag: '--template',
      description: 'Validate PR body against a versioned template when no provenance marker is present.',
      type: 'string',
    },
    createRepoOption(),
  ],
  validInputExample: {
    body: 'Ref: #58\n\n## Summary\n- add PR validation\n\n## Verification\n- `npm test` ✅\n- `npm run lint` ✅\n- `npm run typecheck` ✅\n- `npm run build` ✅\n\n## Docs / ADR / debt\n- docs updated: yes\n- ADR updated: no\n- debt updated: no\n- details: updated the spec\n\n## Risks / follow-ups\n- none',
    template: 'implementation-ready@1.0.0',
  },
  successDataExample: {
    valid: true,
    template: {
      artifact_type: 'pr',
      template_name: 'implementation-ready',
      template_version: '1.0.0',
    },
    template_source: 'explicit' as const,
    normalized_body:
      'Ref: #58\n\n## Summary\n- add PR validation\n\n## Verification\n- `npm test` ✅\n- `npm run lint` ✅\n- `npm run typecheck` ✅\n- `npm run build` ✅\n\n## Docs / ADR / debt\n- docs updated: yes\n- ADR updated: no\n- debt updated: no\n- details: updated the spec\n\n## Risks / follow-ups\n- none\n\n<!-- orfe-template: pr/implementation-ready@1.0.0 -->',
    errors: [],
  },
  requiresCaller: false,
  requiresAuthConfig: false,
  requiresGitHubAccess: false,
  handler: handlePrValidate,
});
