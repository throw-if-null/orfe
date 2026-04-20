# `orfe` architecture invariants

These are the architecture constraints that future work must preserve unless a new ADR intentionally changes them.

## Product boundary invariants

- `orfe` is a **generic GitHub operations runtime**, not a repo-specific workflow engine.
- Repo-specific workflow semantics belong in layers above `orfe`, such as agent prompts, skills, commands, or repository policy.
- `orfe` should expose reusable GitHub operations, not encode one repository's orchestration model.

## Runtime boundary invariants

- The OpenCode wrapper is the **only** layer allowed to read OpenCode runtime caller context such as `context.agent`.
- The core runtime accepts **plain structured data only**.
- The core must stay callable from both CLI and OpenCode wrapper entrypoints.
- The core must not depend on OpenCode-specific APIs or ambient agent identity.

## Artifact contract invariants

- Repo-defined issue and PR body contracts are versioned declarative artifacts under `.orfe/contracts/`, not fields inside `.orfe/config.json`.
- Body contracts may validate and minimally normalize rendered artifact bodies, but they must not execute code, prompt interactively, or cause workflow side effects.
- HTML comment provenance markers are allowed as deterministic machine-readable metadata on rendered issue and PR bodies.
- Contract expressiveness must stay narrow enough that `orfe` remains a generic runtime rather than absorbing repository orchestration semantics.

## Auth and security invariants

- Repo-local config must not contain private keys or machine-local secrets.
- Machine-local auth config contains per-bot GitHub App credentials and stays outside repo-local public contract artifacts.
- `orfe` v1 uses internal GitHub App auth for runtime command execution.
- The runtime must not silently fall back to session auth or other ambient auth modes.
- Caller identity, GitHub bot resolution, and token minting must remain explicit steps.

## Command contract invariants

- Command inputs, validation rules, help behavior, and success/error envelopes are part of the public contract surface.
- Successful commands return structured JSON.
- Valid commands that fail at runtime return structured typed errors.
- Changes to public command behavior should preserve contract stability or be documented intentionally.

## GitHub adapter invariants

- Command behavior uses Octokit directly rather than `gh` shell-outs or GitHub MCP.
- Issue and pull request operations use REST where appropriate.
- Project status and duplicate issue semantics use GraphQL where required for correct GitHub behavior.
- Duplicate issue handling must establish GitHub's canonical duplicate relationship, not only set `state_reason=duplicate`.

## Documentation invariants

- `docs/README.md` is the entrypoint for durable product and architecture memory.
- ADRs preserve the why behind accepted architecture decisions.
- `docs/orfe/spec.md` is the detailed v1 behavior reference, but it is not the only place where project memory should live.
- Generated artifacts such as `dist/` are build outputs, not canonical architecture documentation.
