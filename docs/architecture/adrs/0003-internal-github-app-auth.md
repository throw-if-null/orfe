# ADR 0003: runtime auth uses internal GitHub App token minting

- Status: Accepted
- Date: 2026-04-10

## Context

`orfe` needs predictable role-based GitHub access for command execution.
Relying on ambient `gh` auth, external token helpers, or silent auth fallback would make behavior less explicit and harder to reason about in agent-driven workflows.

## Decision

`orfe` v1 uses internal GitHub App auth.

The runtime resolves `callerName` to a GitHub role, loads machine-local credentials for that role, creates the GitHub App JWT internally, resolves the target installation internally, and mints the installation token internally.

## Consequences

- Auth behavior stays explicit and reviewable.
- Repo-local config remains free of secrets.
- Machine-local auth config becomes an important operator dependency.
- The runtime must fail clearly instead of silently switching to another auth mode.
