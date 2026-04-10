# ADR 0004: command behavior uses Octokit instead of `gh` shell-outs

- Status: Accepted
- Date: 2026-04-10

## Context

`orfe` needs command behavior that is deterministic, testable, and independent of human-oriented shell workflows.
Using `gh` or GitHub MCP as the implementation path would couple runtime behavior to external CLI conventions, session state, and less explicit contracts.

## Decision

Implement runtime command behavior with Octokit.

Use REST where available and GraphQL where required for correct GitHub semantics. Do not use `gh` shell-outs or GitHub MCP as the runtime command implementation layer.

## Consequences

- Command behavior stays closer to explicit API contracts.
- Tests can mock outbound HTTP calls directly with `nock`.
- `orfe` owns more of the API integration surface itself.
- The team must keep API usage current as GitHub behavior evolves.
