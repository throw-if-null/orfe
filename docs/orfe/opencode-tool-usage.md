# `orfe` OpenCode tool usage

This is the canonical agent-facing usage guide for the packaged OpenCode `orfe` tool.

Scope:

- OpenCode tool/plugin usage only
- structured JSON requests and responses
- current supported tool contract

Out of scope:

- CLI usage
- repository workflow policy
- setup/release walkthroughs

For the full v1 command and behavior reference, see `docs/orfe/spec.md`.

## Tool identity

- Tool name: `orfe`
- Requests are JSON objects
- `command` is required and uses the canonical space-separated command name
- Command-specific fields use `snake_case`
- `repo`, `config`, and `auth_config` are plain input fields when a command supports them
- `body_contract` selects a repository-defined issue or PR body contract when applicable

Example request shape:

```json
{
  "command": "issue get",
  "issue_number": 123,
  "repo": "throw-if-null/orfe"
}
```

## Caller identity in OpenCode

The OpenCode wrapper reads `context.agent` and resolves the caller from OpenCode context:

- if `context.agent` is a non-empty string, that string is used
- otherwise, if `context.agent.name` is a non-empty string, that name is used

The wrapper then passes a plain `callerName` string into the shared core runtime.

Important:

- agents should not provide CLI-specific caller environment variables
- agents should not send `caller_name` in tool input
- the runtime core does not read `context.agent` directly

If caller context is missing for a caller-mapped command, the tool returns `caller_context_missing`.

## Commands that do not require repo config, auth config, or GitHub

These commands are runtime-only and work without caller context, repo-local config, machine-local auth config, or GitHub access:

- `runtime info`
- `help`

Examples:

```json
{
  "command": "runtime info"
}
```

```json
{
  "command": "help"
}
```

```json
{
  "command": "help",
  "command_name": "issue get"
}
```

## Commands that do require repo-local and machine-local configuration

All other supported tool commands currently run through the shared core path and require:

- caller identity from OpenCode `context.agent`
- repo-local config, normally `.orfe/config.json`
- machine-local auth config, normally `~/.config/orfe/auth.json`

Many of these commands call GitHub directly. Some commands, such as `issue validate` and `pr validate`, do not create GitHub side effects, but they still use the shared configured runtime path and should be treated as config-dependent tool commands.

## Structured responses

The tool returns the shared `orfe` response envelope.

Success shape:

```json
{
  "ok": true,
  "command": "issue get",
  "repo": "throw-if-null/orfe",
  "data": {
    "issue_number": 123,
    "title": "Add packaged agent-facing OpenCode tool usage docs (`docs/orfe/opencode-tool-usage.md` and `llms.txt`)",
    "state": "open",
    "html_url": "https://github.com/throw-if-null/orfe/issues/123"
  }
}
```

Error shape:

```json
{
  "ok": false,
  "command": "issue get",
  "error": {
    "code": "invalid_usage",
    "message": "Command \"issue get\" requires input field \"issue_number\".",
    "retryable": false
  }
}
```

Notes:

- successful responses always use `ok: true`
- runtime failures use `ok: false` with a typed error object
- `repo` is present for repo-scoped commands and omitted for runtime-only commands such as `help` and `runtime info`
- the wrapper does not redefine field names for the OpenCode path

## Supported command surface

Use `{"command":"help"}` for structured discovery.

Current command families exposed through the tool contract:

- top-level runtime command: `help`
- `auth`: `auth token`
- `issue`: `issue get`, `issue create`, `issue update`, `issue validate`, `issue comment`, `issue set-state`
- `pr`: `pr get`, `pr validate`, `pr get-or-create`, `pr comment`, `pr submit-review`, `pr reply`
- `project`: `project get-status`, `project set-status`
- `runtime`: `runtime info`

## Valid JSON request examples

Read runtime metadata:

```json
{
  "command": "runtime info"
}
```

Discover one command contract:

```json
{
  "command": "help",
  "command_name": "project set-status"
}
```

Mint a caller-scoped installation token:

```json
{
  "command": "auth token",
  "repo": "throw-if-null/orfe"
}
```

Read one issue:

```json
{
  "command": "issue get",
  "issue_number": 123
}
```

Validate a PR body against the repository contract:

```json
{
  "command": "pr validate",
  "body": "Ref: #123\n\n## Summary\n- Add packaged OpenCode tool usage docs\n\n## Verification\n- Documented current tool contract\n\n## Docs / ADR / debt\n- Added docs; no ADR\n\n## Risks / follow-ups\n- Keep examples aligned with the runtime surface",
  "body_contract": "implementation-ready@1.0.0"
}
```

Set a project status value:

```json
{
  "command": "project set-status",
  "item_type": "issue",
  "item_number": 123,
  "status": "In Progress"
}
```

## Common agent-relevant failures

- `invalid_usage`
  - unknown command name
  - unsupported input field
  - missing required field
  - wrong input type
  - attempted `caller_name` input
- `caller_context_missing`
  - OpenCode did not supply usable `context.agent` for a caller-mapped command
- `caller_name_unmapped`, `config_invalid`, `auth_failed`
  - local repo/auth setup is incomplete or does not map the resolved caller to a configured bot
- `github_not_found`
  - the target issue, PR, or other GitHub resource does not exist in the resolved repo
- `project_item_not_found`
  - the target issue or PR is not present on the configured GitHub Project

If you are unsure which command or fields to use, start with `{"command":"help"}` or targeted help for the exact canonical command name.

## Deeper reference

- `docs/orfe/spec.md` is the detailed v1 behavior reference
- `help` returns structured command discovery and command-level examples through the same tool contract

Keep this file focused on OpenCode tool usage. Treat `docs/orfe/spec.md` as the deeper source for detailed semantics and edge cases.
