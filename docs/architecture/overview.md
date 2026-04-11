# `orfe` architecture overview

## Summary

`orfe` is a stand-alone GitHub operations runtime with two entrypoints over the same core behavior:
- a CLI named `orfe`
- an OpenCode custom tool wrapper named `orfe`

The design goal is to provide deterministic, reusable GitHub operations without embedding repository-specific workflow policy into the runtime itself.

## Major runtime parts

### 1. OpenCode wrapper
Located at `.opencode/tools/orfe.ts`.

Responsibilities:
- expose the custom tool name
- read `context.agent`
- resolve a plain `callerName`
- pass only plain data into the runtime core

It must not:
- call GitHub directly for command behavior
- pass raw OpenCode runtime objects into the core

### 2. CLI entrypoint
Located under `src/cli.ts` and related CLI code.

Responsibilities:
- parse CLI arguments
- resolve caller identity for direct CLI usage
- invoke the same runtime core used by the wrapper
- print structured JSON success or structured errors

### 3. Core runtime
Located under `src/core.ts` and related command/config/runtime code.

Responsibilities:
- validate command input
- load repo-local config
- resolve caller-to-role mapping
- load machine-local auth config
- build GitHub clients
- dispatch command handlers
- return structured success or typed errors

The core is runtime-agnostic and must remain callable from both CLI and wrapper entrypoints.

### 4. Config layer
Main files include `src/config.ts` and `.orfe/config.json`.

Responsibilities:
- hold repo-local non-secret configuration
- map caller names to GitHub roles
- define repository and project defaults

### 5. Auth layer
Main file includes `src/github.ts` and machine-local auth config.

Responsibilities:
- load machine-local per-role GitHub App credentials
- mint installation tokens
- keep secret-bearing auth details outside repo-local config

### 6. GitHub adapter layer
Main files include command handlers and client factories.

Responsibilities:
- use Octokit REST where appropriate for issue and PR behavior
- use GraphQL where required for project status and duplicate semantics
- preserve deterministic command behavior and structured outputs

## Module map

```text
OpenCode wrapper / CLI
        |
        v
   core runtime
        |
        +--> config loading
        +--> caller -> role resolution
        +--> auth/token minting
        +--> GitHub client factory
        +--> command registry / handlers
```

## Architectural rules to keep in mind

- wrapper reads OpenCode context; core does not
- core accepts plain data only
- repo-local config contains no secrets
- machine-local auth config contains role credentials
- command behavior uses Octokit, not `gh` shell-outs
- repo workflow policy belongs above `orfe`, not inside it

## Related docs

- `docs/architecture/invariants.md`
- `docs/architecture/auth-model.md`
- `docs/architecture/adrs/`
- `docs/orfe/spec.md`
