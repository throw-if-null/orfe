# `orfe` auth model

## Summary

`orfe` separates GitHub command behavior from GitHub identity handling.

For runtime command behavior, `orfe` uses internal GitHub App auth.
For agent-driven `gh` CLI operations outside runtime commands, the repository still depends on the workspace-root `tokenner` build to mint bot tokens.

This document explains both paths and why they currently coexist.

## Why bot impersonation matters

The repo relies on role-specific bot identities:
- `Z0R4N-BOT`
- `J3L3N4-BOT`
- `GR3G-BOT`
- `KL4R1554-BOT`

Without bot impersonation, `gh` operations would appear as the human operator's session identity instead of the assigned role.
That would weaken auditability, confuse workflow ownership, and blur the distinction between human and agent actions.

## Runtime auth inside `orfe`

For `orfe` command execution:
1. caller identity is resolved
2. repo-local config maps caller name to GitHub role
3. machine-local auth config provides per-role GitHub App credentials
4. `orfe` mints the GitHub App JWT internally
5. `orfe` resolves the installation internally
6. `orfe` mints the installation token internally
7. the runtime uses that token to build Octokit clients

This is the intended v1 runtime auth model.

## Transitional `tokenner` dependency

The repository evolved from a smaller CLI named `tokenner` into the broader `orfe` runtime.

Agents still use the workspace-root helper defined in `AGENTS.md`.

That helper remains necessary for bot-authenticated `gh` CLI operations performed by agents.

## Why the workspace-root helper matters

Do not assume the current issue worktree's `dist/cli.js` exposes the same token command.
The supported helper is the workspace-root build named in `AGENTS.md`.

This prevents worktree-local build drift from breaking bot-authenticated GitHub operations.

## Current two-path model

These two paths are not peer product features.
Path A is part of the `orfe` runtime architecture.
Path B is repository operating procedure used by agents when they perform `gh` CLI operations outside direct runtime command execution.

### Path A: runtime command execution
- used by `orfe` command behavior
- auth is internal to the runtime
- no external token provider shell-out for runtime command behavior

### Path B: agent `gh` CLI operations (repository operating procedure)
- used for GitHub issue, PR, project, and review actions outside direct runtime command execution
- bot token is minted first via the workspace-root helper referenced in `AGENTS.md`
- `gh` is then run with `GH_TOKEN`

## Future direction

The long-term simplification path is to provide a native `orfe token` command or another first-class bot-token path, then retire the transitional `tokenner` dependency intentionally.

Until that happens:
- preserve the current helper path explicitly
- do not treat it as accidental legacy drift
- do not remove or simplify it without a planned migration

## Related docs

- `AGENTS.md`
- `docs/architecture/invariants.md`
- `docs/project/debt.md`
- `docs/orfe/spec.md`
