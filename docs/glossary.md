# `orfe` glossary

## Purpose

This glossary defines durable terminology for `orfe` so docs, config, runtime output, and workflow guidance use the same words consistently.

## Terms

### caller
- whoever invoked `orfe`
- represented in runtime code as `callerName`
- resolved from `context.agent` in the OpenCode wrapper or from `ORFE_CALLER_NAME` in direct CLI usage
- a caller is not automatically the same thing as the GitHub identity used for auth

### bot
- the configured GitHub App-backed identity used for authentication
- selected by mapping a caller to a configured bot name
- backed by machine-local GitHub App metadata and private key material
- represented in config with `caller_to_bot` and `bots`

### role
- reserved for true workflow or ownership meaning
- examples: implementation role, QA role, workflow boundaries, ownership transitions
- not the canonical term for GitHub auth identity in `orfe`

### agent
- an OpenCode runtime concept such as `context.agent`
- may help resolve the caller
- not the canonical term for the GitHub auth identity used by `orfe`

### app slug
- GitHub App metadata such as `GR3G-BOT`
- identifies the GitHub App installation source
- remains `app_slug`; it is not renamed because it already describes GitHub metadata precisely

## Historical note

Earlier `orfe` code and docs used `role` where this glossary now uses `bot` for the GitHub App-backed auth identity.
That older terminology is superseded directly rather than preserved as an alias.
