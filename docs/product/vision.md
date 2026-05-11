# `orfe` product vision

## Summary

`orfe` is a stand-alone GitHub operations runtime for humans and agents that need safe, predictable, reusable GitHub operations.

It provides two entrypoints over the same core behavior:
- an installable CLI named `orfe`
- an OpenCode custom tool wrapper also named `orfe`

## Who it is for

`orfe` is for repositories and teams that already have their own workflow policy, but need a reliable GitHub operations layer underneath that policy.

Primary users include:
- agent-based development systems that need deterministic GitHub operations
- humans operating those systems
- repositories that need GitHub App-based bot auth instead of ambient session auth

## Problem it solves

Without a dedicated runtime, GitHub operations for agents tend to become:
- loosely defined shell usage around `gh`
- dependent on ambient auth state
- hard to validate consistently
- prone to drift in agent-authored issue and PR bodies
- mixed together with repo-specific workflow policy
- brittle across wrappers, prompts, and local tooling

`orfe` exists to make those operations explicit and reusable.

`orfe` is evolving toward a layered model of a shared core plus installable extensions.
The core remains the reusable GitHub/auth/runtime substrate.
Extensions are optional deterministic opinion layers installed into the runtime environment and enabled per repository when needed.

## Product principles

- **Deterministic contracts over ad hoc usage**
  - commands should have explicit inputs, validation rules, and success/error envelopes
- **Explicit identity and auth boundaries**
  - caller identity and GitHub bot selection must be clear and reviewable
- **Generic GitHub operations layer**
  - `orfe` core should stay below repo-specific workflow policy rather than absorb it
- **Optional installable opinion layers**
  - reusable opinionated mechanics may exist as extensions without turning core into a workflow engine
- **Declarative repo enablement**
  - repo config enables and configures installed extensions declaratively and without secrets
- **Safe failure over silent fallback**
  - auth and runtime failures should be explicit instead of quietly switching behavior
- **One core, multiple entrypoints**
  - CLI and OpenCode wrapper usage should share the same runtime semantics

## V1 focus

V1 is focused on a narrow, reusable surface area:
- issue operations
- pull request operations
- GitHub Project Status field operations
- internal GitHub App auth for repository bot identities
- versioned declarative templates for agent-authored issue and PR artifacts
- shared runtime behavior across CLI and OpenCode wrapper entrypoints

In this model, v1 core continues to own:
- GitHub/auth/runtime behavior
- generic command execution and validation contracts
- repo-local declarative non-secret config

Installable extensions are the future home for optional namespaced command families that add deterministic opinionated behavior above that core.
Installed extensions are not active for a repository unless the repository explicitly enables them in config.

## Non-goals

`orfe` v1 does not aim to:
- become a repo-specific workflow engine
- treat installed extensions as active by default for every repository
- let repositories ship executable extension code through repo config
- replace task orchestration agents such as Zoran or Jelena
- own branch/worktree workflow policy
- host executable issue/PR body plugins or interactive authoring flows
- rely on `gh` command behavior as the implementation path for runtime commands
- depend on ambient session auth as the normal auth model
- block progress on full end-to-end live GitHub validation

## What success looks like

`orfe` is successful when:
- agents can call GitHub operations through a stable, documented contract
- the same operation behaves consistently from CLI and OpenCode wrapper entrypoints
- bot-based GitHub App auth is explicit and predictable
- repo-specific workflow layers can build on `orfe` without forcing `orfe` to absorb their policy
- optional extensions can provide reusable deterministic opinion layers without making core itself the workflow engine
- future contributors can understand the project from a small set of durable docs instead of chat history
