# ADR 0001: `orfe` is a generic runtime, not a workflow engine

- Status: Accepted
- Date: 2026-04-10

## Context

`orfe` exists inside a larger agent-driven development environment, but repositories already have their own workflow semantics, ownership rules, and orchestration policy.

If `orfe` absorbed those repo-specific rules, it would become harder to reuse, harder to test cleanly, and more likely to confuse generic GitHub operations with repository workflow policy.

## Decision

Keep `orfe` as a generic GitHub operations runtime.

`orfe` owns reusable GitHub operations and their contracts. Repo-specific workflow semantics remain in higher layers such as agent prompts, repository policy, and workflow orchestration tooling.

## Consequences

- `orfe` stays reusable across repositories with different workflow rules.
- Product and orchestration agents can layer policy on top without forcing `orfe` to encode that policy.
- Some behavior that feels convenient to put in `orfe` should remain outside it if it is repository-specific.
