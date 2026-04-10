# ADR 0005: use GraphQL where REST cannot express the required GitHub semantics

- Status: Accepted
- Date: 2026-04-10

## Context

Most issue and pull request operations fit naturally on GitHub REST APIs.
However, some required semantics in `orfe` v1 are not captured correctly through the same REST path alone.

Examples include:
- GitHub Project Status field operations
- issue duplicate relationships, where setting `state_reason=duplicate` is not enough to establish GitHub's canonical duplicate relationship

## Decision

Use GraphQL for operations where GitHub semantics require it, especially:
- project status field read/write behavior
- duplicate issue relationship mutations and related lookups

Use REST for issue and pull request operations where REST is sufficient.

## Consequences

- `orfe` intentionally uses both REST and GraphQL in v1.
- The API layer is slightly more complex, but command behavior matches GitHub's actual semantics more closely.
- Duplicate handling can preserve GitHub's canonical relationship instead of approximating it.
