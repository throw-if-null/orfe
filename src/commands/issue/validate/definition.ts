import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handleIssueValidate } from './handler.js';

export const issueValidateCommand = createCommandDefinition({
  name: 'issue validate',
  purpose: 'Validate an issue body against a versioned template.',
  usage:
    'orfe issue validate --body <text> [--template <name@version>] [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints structured issue body validation results.',
  examples: [
    'ORFE_CALLER_NAME=Greg orfe issue validate --body "## Problem / context\n..." --template formal-work-item@1.0.0',
    'ORFE_CALLER_NAME=Greg orfe issue validate --body "## Problem / context\n...\n\n<!-- orfe-template: issue/formal-work-item@1.0.0 -->"',
  ],
  options: [
    { key: 'body', flag: '--body', description: 'Issue body to validate.', type: 'string', required: true },
    {
      key: 'template',
      flag: '--template',
      description: 'Validate issue body against a versioned template when no provenance marker is present.',
      type: 'string',
    },
    createRepoOption(),
  ],
  validInputExample: {
    body: '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned template.\n\n## Scope\n\n### In scope\n- declarative templates\n\n### Out of scope\n- executable plugins\n\n## Acceptance criteria\n\n- [ ] templates load from .orfe/templates\n\n## Docs impact\n\n- Docs impact: update existing docs\n- Details: update docs/orfe/spec.md\n\n## ADR needed?\n\n- ADR needed: no\n- Details: covered by ADR 0009\n\n## Dependencies / sequencing notes\n\n- depends on #59\n\n## Risks / open questions / non-goals\n\n- keep repo-specific structure out of runtime logic',
    template: 'formal-work-item@1.0.0',
  },
  successDataExample: {
    valid: true,
    template: {
      artifact_type: 'issue',
      template_name: 'formal-work-item',
      template_version: '1.0.0',
    },
    template_source: 'explicit' as const,
    normalized_body:
      '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned template.\n\n## Scope\n\n### In scope\n- declarative templates\n\n### Out of scope\n- executable plugins\n\n## Acceptance criteria\n\n- [ ] templates load from .orfe/templates\n\n## Docs impact\n\n- Docs impact: update existing docs\n- Details: update docs/orfe/spec.md\n\n## ADR needed?\n\n- ADR needed: no\n- Details: covered by ADR 0009\n\n## Dependencies / sequencing notes\n\n- depends on #59\n\n## Risks / open questions / non-goals\n\n- keep repo-specific structure out of runtime logic\n\n<!-- orfe-template: issue/formal-work-item@1.0.0 -->',
    errors: [],
  },
  requiresCaller: false,
  requiresAuthConfig: false,
  requiresGitHubAccess: false,
  handler: handleIssueValidate,
});
