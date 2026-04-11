# Documentation map

Start here when you need project context.

This directory provides the canonical product and architecture memory for `orfe`.
Use it to understand what the project is for, which constraints must hold, which decisions are settled, and which compromises are known.

## What to read first

### Product intent
- `docs/product/vision.md`
  - what `orfe` is for
  - who it is for
  - product principles
  - v1 focus and non-goals

### Architecture constraints
- `docs/architecture/invariants.md`
  - the architectural truths that future work must preserve
- `docs/architecture/overview.md`
  - the major runtime parts and how they fit together
- `docs/architecture/auth-model.md`
  - the current runtime auth model and transitional bot token path

### Decision history
- `docs/architecture/adrs/`
  - short records of accepted architecture decisions and their consequences

### Known compromises
- `docs/project/debt.md`
  - known documentation, architecture, or process debt that should stay visible
- `docs/project/handoffs.md`
  - standard templates for agent-to-agent workflow handoffs

## Detailed reference material

- `docs/orfe/spec.md`
  - detailed v1 runtime, command, and behavior specification
  - use this after the higher-level product and architecture docs when you need command semantics or deeper implementation detail

## Related repository guidance

- `README.md`
  - project overview, setup, and development commands
- `AGENTS.md`
  - repository workflow rules, role boundaries, and GitHub operating conventions

## How to use this map

- Product questions: start with `docs/product/vision.md`
- Architecture guardrails: read `docs/architecture/invariants.md`
- System shape: read `docs/architecture/overview.md`
- Auth and bot identity model: read `docs/architecture/auth-model.md`
- "Why is it designed this way?": read the ADRs
- "What is intentionally imperfect right now?": read `docs/project/debt.md`
- "How should agents hand work to each other?": read `docs/project/handoffs.md`
- Detailed command/runtime behavior: read `docs/orfe/spec.md`

If these docs drift from implementation, prefer the source code for observed behavior and record the mismatch in `docs/project/debt.md` or a follow-up issue.
