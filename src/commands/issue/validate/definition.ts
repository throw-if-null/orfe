import { createCommandDefinition } from '../../registry/definition.js';
import { createRepoOption } from '../../registry/common-options.js';
import { handleIssueValidate } from './handler.js';

export const issueValidateCommand = createCommandDefinition({
  name: 'issue validate',
  purpose: 'Validate an issue body against a versioned contract.',
  usage:
    'orfe issue validate --body <text> [--body-contract <name@version>] [--repo <owner/name>] [--config <path>] [--auth-config <path>]',
  successSummary: 'Prints structured issue body validation results.',
  examples: [
    'ORFE_CALLER_NAME=Greg orfe issue validate --body "## Problem / context\n..." --body-contract formal-work-item@1.0.0',
    'ORFE_CALLER_NAME=Greg orfe issue validate --body "## Problem / context\n...\n\n<!-- orfe-body-contract: issue/formal-work-item@1.0.0 -->"',
  ],
  options: [
    { key: 'body', flag: '--body', description: 'Issue body to validate.', type: 'string', required: true },
    {
      key: 'body_contract',
      flag: '--body-contract',
      description: 'Validate issue body against a versioned contract when no provenance marker is present.',
      type: 'string',
    },
    createRepoOption(),
  ],
  validInputExample: {
    body: '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned contract.\n\n## Scope\n\n### In scope\n- declarative contracts\n\n### Out of scope\n- executable plugins\n\n## Acceptance criteria\n\n- [ ] contracts load from .orfe/contracts\n\n## Docs impact\n\n- Docs impact: update existing docs\n- Details: update docs/orfe/spec.md\n\n## ADR needed?\n\n- ADR needed: no\n- Details: covered by ADR 0009\n\n## Dependencies / sequencing notes\n\n- depends on #59\n\n## Risks / open questions / non-goals\n\n- keep repo-specific structure out of runtime logic',
    body_contract: 'formal-work-item@1.0.0',
  },
  successDataExample: {
    valid: true,
    contract: {
      artifact_type: 'issue',
      contract_name: 'formal-work-item',
      contract_version: '1.0.0',
    },
    contract_source: 'explicit' as const,
    normalized_body:
      '## Problem / context\n\nNeed deterministic issue-body validation.\n\n## Desired outcome\n\nIssue bodies validate against a versioned contract.\n\n## Scope\n\n### In scope\n- declarative contracts\n\n### Out of scope\n- executable plugins\n\n## Acceptance criteria\n\n- [ ] contracts load from .orfe/contracts\n\n## Docs impact\n\n- Docs impact: update existing docs\n- Details: update docs/orfe/spec.md\n\n## ADR needed?\n\n- ADR needed: no\n- Details: covered by ADR 0009\n\n## Dependencies / sequencing notes\n\n- depends on #59\n\n## Risks / open questions / non-goals\n\n- keep repo-specific structure out of runtime logic\n\n<!-- orfe-body-contract: issue/formal-work-item@1.0.0 -->',
    errors: [],
  },
  requiresCaller: false,
  requiresAuthConfig: false,
  requiresGitHubAccess: false,
  handler: handleIssueValidate,
});
