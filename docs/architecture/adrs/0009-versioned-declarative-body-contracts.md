# ADR 0009: Versioned declarative body contracts for issue and PR artifacts

- Status: Accepted
- Date: 2026-04-19

## Context

`orfe` needs a deterministic way to validate and minimally normalize agent-authored issue and PR bodies before creating or updating those artifacts on GitHub.

The repository already has strong expectations around artifact structure, but relying only on human-facing GitHub templates leaves several gaps:

- no versioned contract identity for a rendered artifact
- no deterministic runtime validation path
- no clear provenance for which structure rules produced a body
- no reusable contract surface that stays below repo-specific workflow orchestration

At the same time, `orfe` must preserve existing architecture constraints:

- it remains a generic GitHub operations runtime, not a repo-specific workflow engine
- the wrapper/core boundary stays intact
- runtime command behavior continues to use Octokit rather than `gh` shell-outs
- repo-local config and machine-local auth config remain separate from other contract artifacts

## Decision

Adopt repository-defined, versioned, declarative body contracts for issue and PR artifacts.

### 1. Canonical contract location

Body contracts live under `.orfe/contracts/` in the repository:

- `.orfe/contracts/issues/<contract-name>/<version>.json`
- `.orfe/contracts/pr/<contract-name>/<version>.json`

They do not live inside `.orfe/config.json`.

### 2. Narrow declarative schema

The first body-contract slice is intentionally narrow and declarative.

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

`<!-- orfe-body-contract: <artifact-type>/<contract-name>@<version> -->`

This keeps provenance machine-readable and minimally intrusive in GitHub rendering.

### 4. Validation contract selection

Validation may resolve the contract from either:

- an explicit command input such as `body_contract`
- an existing provenance marker already present in the body

When both are present, they must match exactly.

### 5. Runtime boundary

Body contracts are part of the generic runtime contract surface for artifact validation and provenance only.
They do not make `orfe` a workflow engine because they do not encode ownership, sequencing, coordination, or repo-specific execution policy.

## Consequences

- issue and PR bodies can carry explicit contract/version provenance
- repositories gain a reusable validation surface without moving workflow policy into `orfe`
- repo-local config remains focused on repository defaults and caller-to-bot mapping
- GitHub-native templates can remain temporary human-facing aids without becoming the canonical runtime source of structure
- future work can build richer authoring support on top of the body-contract foundation without redefining the boundary
