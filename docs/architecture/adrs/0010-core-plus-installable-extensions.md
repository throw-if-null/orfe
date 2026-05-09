# ADR 0010: `orfe` core plus installable extensions

- Status: Accepted
- Date: 2026-05-09

## Context

`orfe` already has a strong reusable core boundary:

- the wrapper reads runtime context and passes plain data into the core
- the core owns deterministic GitHub, auth, config, and command execution behavior
- repository-specific orchestration policy stays outside the runtime

That boundary has worked well, but it leaves a gap for deterministic opinionated mechanics that are reusable across repositories or teams while still sitting above the generic GitHub/auth substrate.

Today, some of that logic lives in prompts and skills. That keeps it out of the core, but it also means:

- setup and cleanup mechanics are repeatedly re-derived
- deterministic task lifecycle rules are harder to validate as runtime behavior
- reusable opinionated command families have no durable home between the generic core and repo-local policy

At the same time, `orfe` must not solve this by turning into a generic workflow engine or by allowing repositories to ship executable extension code inside repo config.

## Decision

Adopt a layered `orfe` architecture of **core plus installable extensions**.

### 1. What stays in core

`orfe core` remains the shared deterministic substrate. It owns:

- the wrapper/core boundary
- repo-local config loading
- machine-local auth loading and token minting
- GitHub client construction and command execution infrastructure
- the generic command registry and built-in generic command groups
- the security and contract invariants that all command execution must preserve

Core remains reusable across repositories and must not absorb repo-specific orchestration policy.

### 2. What belongs in extensions

Extensions are installable deterministic opinion layers that sit above the core.

They may provide:

- namespaced command families
- reusable task or workspace lifecycle mechanics
- opinionated behavior for repositories that choose to enable them

They must not weaken core auth, security, wrapper/core, or deterministic-contract boundaries.

### 3. Install scope and activation model

Extensions are installed into the `orfe` runtime environment, not shipped as executable code from the repository itself.

Activation is explicitly layered:

- **installed** does not mean **enabled**
- **enabled** does not mean **validly configured**

The runtime may discover installed extensions, but an extension is not active for a repository unless that repository enables it in `.orfe/config.json`.

### 4. Repo enablement and per-extension settings

Repository enablement is declarative and non-secret.

Per-extension repo settings live in `.orfe/config.json` and use `config` as the setting key:

```json
{
  "extensions": {
    "workspace": {
      "enabled": true,
      "config": {
        "worktree_root": ".worktrees"
      }
    }
  }
}
```

Rules:

- repo config declares enablement and settings only
- repo config remains non-secret
- repositories do not ship executable extension code through config
- use `config`, not `profile`, for per-extension repo settings unless a future need justifies profiles explicitly

### 5. Discovery, compatibility, and command namespacing

Each extension must have:

- a stable extension name
- a namespaced command surface under that name
- a compatibility contract that declares which `orfe` core versions it supports

Core should load only extensions that are both:

- installed in the runtime environment
- compatible with the running core version

Extension commands remain explicit and namespaced rather than blending into built-in core groups.
For example, an extension named `workspace` would own commands such as `workspace start` or `workspace cleanup`.

### 6. Relation to ADR 0001

This ADR **refines** ADR 0001 rather than replacing it.

ADR 0001 established that `orfe` is not a repo-specific workflow engine and must not absorb repository orchestration policy into the generic runtime.
That still holds.

The refinement is:

- generic reusable substrate stays in core
- installable opinionated mechanics move into explicit extensions
- repository-specific executable policy still does not live in the repository
- repositories only declare whether an installed extension is enabled and how it is configured

So `orfe` still does not become a generic workflow engine. It becomes a generic core with optional deterministic opinion layers that are installed separately and enabled explicitly.

## Consequences

- reusable opinionated command families now have a home that is not the core and not ad hoc prompt logic
- core can stay small, generic, and reusable
- repositories can share the same installed extension while enabling or configuring it differently
- extension discovery, compatibility validation, and loading behavior now need explicit implementation work
- future first-party workflow mechanics should land as extensions rather than expanding the generic core command surface
