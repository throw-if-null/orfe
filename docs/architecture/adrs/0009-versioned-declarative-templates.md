# ADR 0009: Versioned declarative templates for issue and PR artifacts

- Status: Accepted
- Date: 2026-04-19

## Context

`orfe` needs a deterministic way to validate and minimally normalize agent-authored issue and PR bodies before creating or updating those artifacts on GitHub.

The repository already has strong expectations around artifact structure, but relying only on human-facing GitHub templates leaves several gaps:

- no versioned template identity for a rendered artifact
- no deterministic runtime validation path
- no clear provenance for which structure rules produced a body
- no reusable template surface that stays below repo-specific workflow orchestration

At the same time, `orfe` must preserve existing architecture constraints:

- it remains a generic GitHub operations runtime, not a repo-specific workflow engine
- the wrapper/core boundary stays intact
- runtime command behavior continues to use Octokit rather than `gh` shell-outs
- repo-local config and machine-local auth config remain separate from other template artifacts

## Decision

Adopt repository-defined, versioned, declarative templates for issue and PR artifacts.

### 1. Canonical template location

Templates live under `.orfe/templates/` in the repository:

- `.orfe/templates/issues/<template-name>/<version>.json`
- `.orfe/templates/pr/<template-name>/<version>.json`

They do not live inside `.orfe/config.json`.

### 2. Narrow declarative schema

The first template slice is intentionally narrow and declarative.

Supported primitives include:

- top-level required and forbidden regex patterns
- preamble required and forbidden regex patterns
- required sections
- section emptiness rules
- section-level required and forbidden regex patterns
- simple list-style fields with allowed-value validation

Not supported in this foundation:

- executable plugins
- interactive prompting or authoring flows
- workflow side effects such as labels, assignees, projects, or ownership changes
- repository orchestration semantics

### 3. Provenance markers

Rendered artifacts use a deterministic HTML comment provenance marker:

`<!-- orfe-template: <artifact-type>/<template-name>@<version> -->`

This keeps provenance machine-readable and minimally intrusive in GitHub rendering.

### 4. Validation contract selection

Validation may resolve the template from either:

- an explicit command input such as `template`
- an existing provenance marker already present in the body

When both are present, they must match exactly.

### 5. Runtime boundary

Templates are part of the generic runtime contract surface for artifact validation and provenance only.
They do not make `orfe` a workflow engine because they do not encode ownership, sequencing, coordination, or repo-specific execution policy.

## Consequences

- issue and PR bodies can carry explicit template/version provenance
- repositories gain a reusable validation surface without moving workflow policy into `orfe`
- repo-local config remains focused on repository defaults and caller-to-bot mapping
- GitHub-native templates can remain temporary human-facing aids without becoming the canonical runtime source of structure
- future work can build richer authoring support on top of the template foundation without redefining the boundary
