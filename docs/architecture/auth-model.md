# `orfe` auth model

## Summary

`orfe` separates GitHub command behavior from GitHub identity handling.

For runtime command behavior, `orfe` uses internal GitHub App auth.
For agent-driven `gh` CLI operations outside runtime commands, agents mint bot tokens through the OpenCode `orfe` function tool and pass them explicitly to `gh`.

This document explains both paths and why they currently coexist.

## Why bot auth matters

The repo relies on named bot identities:
- `Z0R4N-BOT`
- `J3L3N4-BOT`
- `GR3G-BOT`
- `KL4R1554-BOT`

Without bot auth, `gh` operations would appear as the human operator's session identity instead of the assigned bot.
That would weaken auditability, confuse workflow ownership, and blur the distinction between human and agent actions.

## Runtime auth inside `orfe`

For `orfe` command execution:
1. caller identity is resolved
2. the runtime resolves that caller to a configured GitHub bot
3. machine-local auth config provides per-bot GitHub App credentials
4. `orfe` mints the GitHub App JWT internally
5. `orfe` resolves the installation internally
6. `orfe` mints the installation token internally
7. the runtime uses that token to build Octokit clients or returns it directly for `orfe auth token`

`orfe auth token` follows the same self-identity path. It is not a cross-bot impersonation command and does not accept a bot override.

This is the intended v1 runtime auth model.

## Function-tool token minting for `gh` writes

When an operation is not covered by the OpenCode `orfe` tool directly, agents still sometimes need to use `gh`.

In those cases the supported procedure is:

1. call the OpenCode `orfe` function tool with `command: auth token`
2. receive a bot-scoped installation token through the same self-identity path used by runtime commands
3. run `gh` with that token via `GH_TOKEN`

This keeps bot identity explicit without relying on shelling out to a workspace-local helper.

The function-tool path is also why the workflow skills explicitly say not to use bash for token minting.

## Current two-path model

These two paths are not peer product features.
Path A is part of the `orfe` runtime architecture.
Path B is repository operating procedure used by agents when they perform `gh` CLI operations outside direct runtime command execution.

### Path A: runtime command execution
- used by `orfe` command behavior
- auth is internal to the runtime
- no external token provider shell-out for runtime command behavior
- includes native token minting via `orfe auth token`

### Path B: agent `gh` CLI operations (repository operating procedure)
- used for GitHub issue, PR, project, and review actions outside direct runtime command execution
- bot token is minted first via the OpenCode `orfe` function tool referenced in `AGENTS.md`
- `gh` is then run with `GH_TOKEN`

## Future direction

The long-term simplification path is to keep shrinking the set of repository procedures that need `gh` CLI writes at all by covering more operations directly in the OpenCode `orfe` tool.

Until that happens:
- preserve the current function-tool token-minting path explicitly
- do not silently fall back to session auth
- do not replace the function-tool path with bash token minting

## Related docs

- `AGENTS.md`
- `docs/architecture/invariants.md`
- `docs/project/debt.md`
- `docs/orfe/spec.md`
