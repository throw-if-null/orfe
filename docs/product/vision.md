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
- repositories that need GitHub App-based role impersonation instead of ambient session auth

## Problem it solves

Without a dedicated runtime, GitHub operations for agents tend to become:
- loosely defined shell usage around `gh`
- dependent on ambient auth state
- hard to validate consistently
- mixed together with repo-specific workflow policy
- brittle across wrappers, prompts, and local tooling

`orfe` exists to make those operations explicit and reusable.

## Product principles

- **Deterministic contracts over ad hoc usage**
  - commands should have explicit inputs, validation rules, and success/error envelopes
- **Explicit identity and auth boundaries**
  - caller identity and GitHub role selection must be clear and reviewable
- **Generic GitHub operations layer**
  - `orfe` should stay below repo-specific workflow policy rather than absorb it
- **Safe failure over silent fallback**
  - auth and runtime failures should be explicit instead of quietly switching behavior
- **One core, multiple entrypoints**
  - CLI and OpenCode wrapper usage should share the same runtime semantics

## V1 focus

V1 is focused on a narrow, reusable surface area:
- issue operations
- pull request operations
- GitHub Project Status field operations
- internal GitHub App auth for repo role impersonation
- shared runtime behavior across CLI and OpenCode wrapper entrypoints

## Non-goals

`orfe` v1 does not aim to:
- become a repo-specific workflow engine
- replace task orchestration agents such as Zoran or Jelena
- own branch/worktree workflow policy
- rely on `gh` command behavior as the implementation path for runtime commands
- depend on ambient session auth as the normal auth model
- block progress on full end-to-end live GitHub validation

## What success looks like

`orfe` is successful when:
- agents can call GitHub operations through a stable, documented contract
- the same operation behaves consistently from CLI and OpenCode wrapper entrypoints
- role-based GitHub App auth is explicit and predictable
- repo-specific workflow layers can build on `orfe` without forcing `orfe` to absorb their policy
- future contributors can understand the project from a small set of durable docs instead of chat history
