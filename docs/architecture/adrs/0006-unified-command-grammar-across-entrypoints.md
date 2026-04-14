# ADR 0006: Unified command grammar across CLI and OpenCode tool entrypoints

- Status: Accepted
- Date: 2026-04-14

## Context

`orfe` exposed two different command grammars for the same operations.
The CLI used space-separated subcommands such as `orfe auth token` and `orfe issue get`, while the OpenCode tool contract and some internal/public references used dot-notation such as `auth.token` and `issue.get`.

That split caused agent confusion, documentation drift, and unnecessary translation between entrypoints that should represent the same command model.

## Decision

Adopt a single canonical space-separated command vocabulary for both entrypoints.

Examples:

- `auth token`
- `issue get`
- `issue create`
- `issue update`
- `issue comment`
- `issue set-state`
- `pr get`
- `pr get-or-create`
- `pr comment`
- `pr submit-review`
- `pr reply`
- `project get-status`
- `project set-status`

The OpenCode tool `command` parameter now uses the same space-separated names as the CLI subcommands.
Dot-notation names are removed entirely from the public contract, with no compatibility aliases.

## Consequences

- There is one command vocabulary to learn and document.
- CLI and OpenCode tool entrypoints now differ only in invocation mechanism, not command naming.
- Specs, tests, AGENTS guidance, and agent prompts can teach one consistent mental model.
- Existing dot-notation tool callers must be updated; they are intentionally not supported as aliases.
