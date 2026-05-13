# ADR 0007: Vertical command slices with an explicit generic registry

- Status: Accepted
- Date: 2026-04-16

## Context

`orfe` had already established the correct high-level runtime boundaries between wrapper, CLI, core, config, auth, and GitHub access.
However, command behavior was still concentrated in a few large modules and in several centralized command metadata files.

That created a number of problems:

- command behavior was difficult to understand locally
- command contract ownership was split across registry code, contract files, and hardcoded command-name lists
- the registry carried command-specific meaning instead of acting only as composition infrastructure
- CLI help and commandless behavior depended on hardcoded group knowledge
- command-specific tests were biased toward large central test files instead of slice-local ownership

## Decision

Adopt a vertical command-slice architecture with an explicit generic command registry.

### 1. Each command is a slice

Each command/subcommand is implemented in its own directory under `src/commands/<group>/<command>/`.

Preferred contents:

- `definition.ts`
- `handler.ts`
- `errors.ts` when command-local validation or business-rule errors need a local home
- `*.test.ts` for slice-local tests

### 2. Slice-owned contract metadata

Each command slice owns its:

- canonical command name
- help and usage metadata
- examples
- option definitions
- validation logic
- valid input example
- success data example
- handler wiring

Centralized `command-contracts.ts` is retired.

### 3. Explicit generic registry

`src/commands/index.ts` exports the explicit `COMMANDS` registration array.

The registry layer:

- explicitly imports slices
- supports lookup, listing, grouping, and generic validation
- derives command identity types from registered commands
- enforces deterministic registration

The registry must not assemble command semantics from a second source of truth.

### 4. Minimal definition helper

`createCommandDefinition(...)` remains minimal.

Its responsibilities are limited to:

- deriving `group` and `leaf` from the canonical `name`
- preserving type inference
- acting as a typed pass-through

It does not inject examples or contract metadata from elsewhere.

### 5. Thin CLI adapter

The CLI remains an adapter layer.

It:

- supports commandless invocation as a help/noop path
- renders root, group, and leaf help from registered metadata
- parses options generically
- invokes the core
- prints structured success and error output

It does not become a host for command business rules.

### 6. Group-local shared helpers are allowed

When commands within one group share helper logic, that logic may live under a small `shared/` directory scoped to that group, using responsibility-named modules rather than a catch-all file.
These helpers must remain subordinate to the slice architecture.

## Consequences

- command ownership is local and discoverable by directory
- command identity now has one authoritative registration path
- help text, examples, valid input fixtures, and success examples live with the command they describe
- registry behavior is simpler and more generic
- CLI behavior is driven from registry metadata instead of hardcoded command-group maps
- command tests can be co-located by default while cross-cutting integration tests remain in `test/`
