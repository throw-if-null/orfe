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

### Ubiquitous language
- `docs/glossary.md`
  - durable definitions for caller, bot, role, and related terms

### Known compromises
- `docs/project/debt.md`
  - known documentation, architecture, or process debt that should stay visible

## Workflow guidance

- `docs/project/handoffs.md`
  - standard templates for agent-to-agent handoffs and their matching workflow events

## Detailed reference material

- `docs/orfe/spec.md`
  - detailed v1 runtime, command, and behavior specification
  - includes the canonical body-contract model for issue and PR artifact validation/provenance
  - use this after the higher-level product and architecture docs when you need command semantics or deeper implementation detail

## Repo-local contract artifacts

- `.orfe/contracts/`
  - versioned declarative issue and PR body contracts consumed by `orfe`
  - separate from `.orfe/config.json` and machine-local auth config

## Related repository guidance

- `README.md`
  - project overview, setup, and development commands
- `AGENTS.md`
  - repository workflow rules, workflow-role boundaries, and GitHub operating conventions

## How to use this map

- Product questions: start with `docs/product/vision.md`
- Architecture guardrails: read `docs/architecture/invariants.md`
- System shape: read `docs/architecture/overview.md`
- Auth and bot identity model: read `docs/architecture/auth-model.md`
- Terminology and identity definitions: read `docs/glossary.md`
- "Why is it designed this way?": read the ADRs
- "What is intentionally imperfect right now?": read `docs/project/debt.md`
- "How should agents hand work to each other?": read `docs/project/handoffs.md`
- Detailed command/runtime behavior: read `docs/orfe/spec.md`
- Repo-defined issue/PR body contract rules: read `docs/orfe/spec.md` and `docs/architecture/invariants.md`

If these docs drift from implementation, prefer the source code for observed behavior and record the mismatch in `docs/project/debt.md` or a follow-up issue.
