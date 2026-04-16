# `orfe` architecture overview

## Summary

`orfe` is a stand-alone GitHub operations runtime with two entrypoints over the same core behavior:
- a CLI named `orfe`
- an OpenCode plugin that registers the `orfe` tool

The design goal is to provide deterministic, reusable GitHub operations without embedding repository-specific workflow policy into the runtime itself.

## Major runtime parts

### 1. OpenCode plugin entrypoint
Currently represented by `src/plugin.ts`, exported from the package at `./plugin`, and consumed by repositories through the `opencode.json` `plugin` array.

Responsibilities:
- expose the `orfe` tool through `OrfePlugin`
- read `context.agent`
- resolve a plain `callerName`
- pass only plain data into the runtime core

It must not:
- call GitHub directly for command behavior
- pass raw OpenCode runtime objects into the core

### 2. CLI entrypoint
Currently represented by `src/cli.ts` and related CLI code.

Responsibilities:
- support commandless invocation as a noop/help path
- parse CLI arguments generically from registered command metadata
- resolve caller identity for direct CLI usage
- invoke the same runtime core used by the plugin entrypoint
- print structured JSON success or structured errors

The CLI is intentionally a thin adapter. It renders root, group, and leaf help from the registered command catalog rather than maintaining a separate hardcoded command map.

### 3. Core runtime
Currently represented by `src/core.ts` and related command/config/runtime code.

Responsibilities:
- validate command input through command slice definitions
- load repo-local config
- resolve caller-to-role mapping
- load machine-local auth config
- build GitHub clients
- dispatch command handlers
- return structured success or typed errors

The core is runtime-agnostic and must remain callable from both CLI and plugin entrypoints.

### 4. Config layer
Current examples include `src/config.ts` and `.orfe/config.json`.

Responsibilities:
- hold repo-local non-secret configuration
- map caller names to GitHub roles
- define repository and project defaults

### 5. Auth layer
Current examples include `src/github.ts` and machine-local auth config.

Responsibilities:
- load machine-local per-role GitHub App credentials
- mint installation tokens
- keep secret-bearing auth details outside repo-local config

### 6. GitHub adapter layer
Current examples include command handlers and client factories.

Responsibilities:
- use Octokit REST where appropriate for issue and PR behavior
- use GraphQL where required for project status and duplicate semantics
- preserve deterministic command behavior and structured outputs

## Command architecture

### Vertical command slices

Command behavior is organized by explicit vertical slices under `src/commands/`.

Default shape:

```text
src/commands/
  <group>/
    shared.ts                 # small group-local helpers only when reused
    <command>/
      definition.ts           # name, help, options, examples, valid input, success example, validation
      handler.ts              # command implementation
      errors.ts               # command-local validation/business-rule helpers when needed
      *.test.ts               # co-located command tests by default
```

Examples:

- `src/commands/issue/get/definition.ts`
- `src/commands/issue/get/handler.ts`
- `src/commands/pr/get-or-create/definition.ts`
- `src/commands/project/shared.ts`

Each slice owns its command contract metadata, including:

- command name
- purpose and usage/help text
- examples
- option definitions
- validation logic
- valid input example used by tests
- success data example used by tests/help
- handler wiring

### Explicit generic registry

The command registry is now an explicit composition layer.

Key modules:

- `src/commands/index.ts` — explicit `COMMANDS` registration array
- `src/commands/registry/definition.ts` — minimal `createCommandDefinition(...)` helper
- `src/commands/registry/index.ts` — generic lookup/list/group/validation helpers

The registry:

- explicitly imports command slice definitions
- exposes deterministic command lookup and listing
- derives command identity types from the `COMMANDS` array
- performs generic option-shape validation only

The registry does not own per-command semantics from a separate contract source of truth.

### Group-local shared helpers

When multiple commands in the same group share normalization or lookup logic, that logic lives in a small group-local helper module such as:

- `src/commands/issue/shared.ts`
- `src/commands/pr/shared.ts`
- `src/commands/project/shared.ts`

These files are intentionally group-scoped helper modules, not replacements for the slice structure.

## Module map

```text
OpenCode plugin / CLI
        |
        v
   core runtime
        |
        +--> config loading
        +--> caller -> role resolution
        +--> auth/token minting
        +--> GitHub client factory
        +--> explicit command registry / slices
```

## Architectural rules to keep in mind

- plugin entrypoint reads OpenCode context; core does not
- core accepts plain data only
- repo-local config contains no secrets
- machine-local auth config contains role credentials
- command behavior uses Octokit, not `gh` shell-outs
- repo workflow policy belongs above `orfe`, not inside it

These file references are descriptive of the current layout, not a promise that file organization will never change.
When files move, update this overview if the conceptual boundaries also need clarification.

## Related docs

- `docs/architecture/invariants.md`
- `docs/architecture/auth-model.md`
- `docs/architecture/adrs/`
- `docs/orfe/spec.md`
