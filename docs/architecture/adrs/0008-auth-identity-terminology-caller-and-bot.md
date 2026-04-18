# ADR 0008: Canonical auth identity terms are `caller` and `bot`

- Status: Accepted
- Date: 2026-04-18

## Context

`orfe` previously used `role` for the GitHub App-backed identity it authenticates as.
That wording became misleading because `role` already reads like workflow responsibility, ownership, or authorization language.

This ambiguity affected multiple layers at once:

- repo-local config
- machine-local auth config
- runtime types and outputs
- CLI and spec language
- durable docs and repository workflow guidance

The project also needed a durable distinction between:

- `caller`: whoever invoked `orfe`
- `bot`: the GitHub App-backed identity used for auth
- `role`: workflow or ownership meaning only

The term `agent` was also considered, but it is already an OpenCode runtime concept tied to `context.agent` and therefore not a precise label for the GitHub auth identity.

`orfe` is still in active development and not in production use, so backward compatibility is not a constraint for this terminology correction.

## Decision

Adopt these canonical terms across code, config, outputs, specs, and docs:

- `caller` = whoever invoked `orfe`
- `bot` = the configured GitHub App-backed identity used for auth
- `role` = reserved for true workflow or ownership meaning only

Specific schema and contract changes:

- repo-local config: `caller_to_github_role` -> `caller_to_bot`
- machine-local auth config: `roles` -> `bots`
- runtime output and command examples: `role` -> `bot` where the meaning is auth identity

`agent` is not used as the auth-identity term.
It may still describe OpenCode runtime context, but it is not the canonical label for the GitHub identity that `orfe` authenticates as.

## Compatibility decision

This is a direct replacement.

- no aliases
- no backward-compatibility shims
- no migration layer

Older docs and code that used `role` for auth identity are treated as historical terminology, not as an ongoing supported contract.

## Consequences

- auth terminology becomes distinct from workflow terminology
- config and runtime contracts become clearer about caller identity versus auth identity
- `role` remains available for repository process docs where it truly means responsibility or ownership
- existing ADR bodies remain unchanged as point-in-time records; historical clarification now lives in this ADR and the glossary
