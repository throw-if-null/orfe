# `orfe` v1 specification

Status: canonical v1 design for issue #13  
Applies to follow-up implementation issues #14 and #15

See also:
- `docs/README.md` for the documentation map
- `docs/product/vision.md` for product intent and non-goals
- `docs/architecture/invariants.md` for the architecture constraints this spec assumes
- `docs/architecture/adrs/` for accepted design decisions captured as ADRs
- `docs/project/debt.md` for known documentation and architecture drift

## 1. Purpose

`orfe` is a stand-alone GitHub operations tool with two entrypoints:

- an installable CLI named `orfe`
- an OpenCode custom tool wrapper also named `orfe`

V1 exists to provide a deterministic, reusable contract for:

- explicit GitHub App token minting
- generic issue operations
- generic pull request operations
- GitHub Project Status field read/write operations

`orfe` is a generic GitHub operations layer. It does not own repo-local workflow semantics or higher-level coordination policy; those belong in callers layered on top of generic `orfe` commands.

## 2. Resolved design decisions

1. `orfe` is a stand-alone tool, not a repo-specific workflow engine.
2. The OpenCode wrapper is the **only** layer allowed to read `context.agent`.
3. The wrapper resolves a plain `callerName` string and passes that into the `orfe` core.
4. The core never reads `context.agent` directly.
5. Repo-local config maps `callerName` to the GitHub bot used for auth.
6. `orfe` uses Octokit as the GitHub API client layer.
7. Issue and PR operations should use Octokit REST where available.
8. GitHub Project Status operations should use Octokit GraphQL.
9. GitHub App auth is the default and only auth mode in v1.
10. `orfe` mints GitHub App installation tokens internally; it does not shell out to an external token provider.
11. Issue duplicate handling must create GitHub's actual duplicate relationship, not only set `state_reason=duplicate`.
12. `gh` and GitHub MCP are **not** the command implementation layer for `orfe` behavior.
13. Command-level HTTP mocking uses `nock`.
14. Full end-to-end testing is a later milestone and does not block issue #13.

For terminology in this spec:

- `caller` means whoever invoked `orfe`
- `bot` means the GitHub App-backed identity used for auth
- `role` is reserved for workflow meaning outside this auth contract

## 3. Scope

### 3.1 Packaging and installation boundary

- npm package name: `@mirzamerdovic/orfe`
- installed executable name: `orfe`
- package CLI entrypoint: package `bin.orfe -> dist/cli.js`
- primary public distribution is npmjs.org (`https://registry.npmjs.org`)
- supported invocation path is `npx @mirzamerdovic/orfe`
- package-artifact installs produced by `npm pack` remain valid for local development
- package installation does not create repo-local config or machine-local auth config; those remain separate operator-managed setup steps

### In scope for v1

- package/runtime architecture
- CLI contract
- OpenCode wrapper contract
- wrapper/core boundary
- caller resolution rules
- repo-local config model
- success/error/help contract
- naming conventions
- idempotency rules for applicable commands
- these command groups only:
  - `auth`
  - `issue`
  - `pr`
  - `project`
  - `runtime`

### Out of scope for v1

- git branch/worktree operations
- merge automation
- reviewer assignment policy
- agent permission policy changes
- e2e/live GitHub validation as a blocker for #13, #14, or #15
- install-time config bootstrapping

## 4. Architecture

`orfe` v1 is split into four layers.

### 4.1 OpenCode wrapper

Responsibilities:

- expose the custom tool name `orfe`
- read `context.agent`
- resolve `callerName`
- reject missing or invalid caller context
- pass plain structured input plus `callerName` into the core

The wrapper must not:

- call GitHub directly
- load repo config itself except as needed to locate repo context
- pass raw OpenCode runtime objects into the core

`context.agent` is only an input source for resolving the caller.
It is not the auth identity itself.

### 4.2 Core runtime

Responsibilities:

- parse/validate command input
- load repo-local config
- resolve `callerName -> github bot`
- acquire an auth token through the configured auth adapter
- build Octokit clients
- dispatch command handlers
- return structured success objects or typed errors

The core is runtime-agnostic. It must be callable from both CLI and OpenCode wrapper code.

### 4.3 Auth adapter

V1 auth is bot-aware and internal to `orfe`.

Auth flow:

1. the wrapper or CLI provides `callerName`
2. the core resolves `callerName -> github bot`
3. the auth adapter loads machine-local auth config for that GitHub bot
4. the auth adapter reads the GitHub App credentials and private key path for that bot
5. `orfe` creates a GitHub App JWT internally
6. `orfe` resolves the repository installation for the target repo internally
7. `orfe` mints a GitHub App installation token internally
8. the core builds Octokit clients with that installation token or returns token metadata directly for `auth token`

The auth adapter is part of the `orfe` runtime. It must not:

- shell out to an external token provider
- recursively invoke `orfe` to mint its own token
- depend on `gh` auth
- silently fall back to session auth

The core must never silently fall back to a different auth mode.

### 4.4 GitHub adapter

- Octokit REST for issue and PR operations
- Octokit GraphQL for GitHub Project Status field operations
- Octokit GraphQL for issue duplicate relationship mutations
- no `gh` shell-outs for command behavior
- no GitHub MCP dependency for command behavior

For `issue set-state` specifically:

- non-duplicate open/close transitions use Octokit REST issue update operations
- duplicate closure uses Octokit GraphQL because REST `state_reason=duplicate` alone does not establish GitHub's canonical duplicate relationship

## 5. Wrapper/core boundary

The boundary is strict.

### 5.1 Wrapper input source

At the OpenCode boundary, the wrapper resolves the caller from `context.agent` only.

Resolution rules:

1. If `context.agent` is a non-empty string, use that string.
2. Else if `context.agent.name` is a non-empty string, use that string.
3. Else fail with `caller_context_missing`.

After resolution, the wrapper passes only a plain string:

```ts
type CallerName = string;
```

### 5.2 Core input contract

The core receives plain data only:

```ts
interface OrfeCoreRequest {
  callerName?: string;
  command: OrfeCommandName;
  input: Record<string, unknown>;
  cwd?: string; // current working directory
  configPath?: string;
  authConfigPath?: string;
}
```

The core must not depend on:

- `context.agent`
- OpenCode-specific APIs
- global agent identity
- ambient session auth

### 5.3 CLI caller resolution

The CLI does not have `context.agent`, so direct CLI usage must provide caller identity explicitly for commands that resolve auth via caller mapping.

Resolution order:

1. `ORFE_CALLER_NAME=<value>`
2. fail with `caller_name_missing`

## 6. Repo-local config model

Default path:

```text
.orfe/config.json
```

CLI may override the path with `--config <path>`.

### 6.1 Required repo-local config shape

```json
{
  "version": 1,
  "repository": {
    "owner": "throw-if-null",
    "name": "orfe",
    "default_branch": "main"
  },
  "caller_to_bot": {
    "Greg": "greg",
    "Jelena": "jelena",
    "Zoran": "zoran",
    "Klarissa": "klarissa"
  },
  "projects": {
    "default": {
      "owner": "throw-if-null",
      "project_number": 2,
      "status_field_name": "Status"
    }
  }
}
```

### 6.2 Config rules

- `version` is required and must equal `1` for v1.
- `repository.owner` and `repository.name` are required.
- `repository.default_branch` is optional in principle but required by this repo's v1 usage because `pr get-or-create` needs a default base branch.
- `caller_to_bot` is required and maps exact `callerName` strings to GitHub bot names.
- Matching is exact after trimming surrounding whitespace; no case folding is performed.
- `projects.default` is optional overall, but if omitted then `project` commands must require explicit project options.
- repo-local config must not contain private keys, GitHub App IDs, or other machine-local auth secrets.

### 6.3 Machine-local auth config model

Default path:

```text
~/.config/orfe/auth.json
```

CLI may override the auth config path with `--auth-config <path>`.

Required machine-local auth config shape:

```json
{
  "version": 1,
  "bots": {
    "greg": {
      "provider": "github-app",
      "app_id": 123458,
      "app_slug": "GR3G-BOT",
      "private_key_path": "~/.config/orfe/keys/greg.pem"
    },
    "jelena": {
      "provider": "github-app",
      "app_id": 123457,
      "app_slug": "J3L3N4-BOT",
      "private_key_path": "~/.config/orfe/keys/jelena.pem"
    }
  }
}
```

Rules:

- `version` is required and must equal `1`.
- `bots` is required.
- each GitHub bot referenced by repo-local `caller_to_bot` must have a corresponding machine-local bot entry when that caller is used.
- `provider` is required and must equal `github-app` in v1.
- `app_id`, `app_slug`, and `private_key_path` are required for each bot.
- `private_key_path` may use `~` and is expanded locally at runtime.
- this file is machine-local, must not be committed, and is outside the repo-local public contract artifact set.

### 6.4 Internal token minting behavior

For each command execution, `orfe` must:

1. resolve the GitHub bot from repo-local config
2. load that bot's GitHub App credentials from machine-local auth config
3. mint the GitHub App JWT internally
4. resolve the installation for the target repository internally
5. mint the installation token internally
6. construct Octokit clients from that token

The public contract does not expose any `token_command`, external token hook, or compatibility requirement with prior tooling.

### 6.5 Config non-goals

The config file does not define:

- issue/PR templates
- reviewer policy
- permission policy
- git workflow rules

### 6.6 Repo-local body contracts

Versioned issue and PR body contracts are separate repo-local artifacts, not fields inside `.orfe/config.json`.

Canonical location:

```text
.orfe/contracts/issues/<contract-name>/<version>.json
.orfe/contracts/pr/<contract-name>/<version>.json
```

Rules:

- contracts are repository-defined JSON artifacts
- contracts are declarative only; they must not contain executable code
- contracts are part of the repo-local public contract surface, but remain distinct from both repo config and machine-local auth config
- contract loading is deterministic by artifact type, contract name, and version
- GitHub-native issue and PR templates may remain transitional human-facing aids, but `orfe` contract behavior must not depend on them

## 7. Naming conventions

### 7.1 CLI names

- executable: `orfe`
- command groups: kebab-case where needed
- leaf commands: kebab-case
- examples: `pr get-or-create`, `project set-status`

### 7.2 Input/output field names

- structured tool input fields: `snake_case`
- JSON success/error fields: `snake_case`
- examples: `issue_number`, `pr_number`, `comment_id`, `state_reason`

### 7.3 CLI options

- CLI flags use kebab-case
- examples: `--issue-number`, `--project-number`

### 7.4 Standard verbs

- read: `get`
- create-if-missing: `get-or-create`
- mutate state directly: `set-state`, `set-status`

## 8. Shared command behavior

## 8.1 Common CLI options

These options are available to every leaf command:

- `--config <path>`
- `--auth-config <path>`
- `--repo <owner/name>`
- `--help`

`--repo` overrides `repository.owner/name` from config for issue and PR commands. If omitted, config repository values are used.

`auth token` requires `--repo` explicitly because token minting targets a specific repository installation.

Project commands use the same repo override for issue/PR item lookup and separate project-specific options for project owner/number.

### 8.2 Help behavior

Root-level informational invocations must support:

- `orfe --help`
- `orfe --version`

The runtime command surface must also support:

- `orfe runtime info`
- `{ "command": "runtime info" }`

`--help` must work at three levels:

- `orfe --help`
- `orfe <group> --help`
- `orfe <group> <command> --help`

`orfe --version` prints the installed package version to stdout and exits `0`.
It must not require caller identity, repo config, auth config, or any GitHub access.
`-v` is not supported as an alias.

`orfe runtime info` returns structured JSON describing the active runtime version and entrypoint.
It must not require caller identity, repo config, auth config, or any GitHub access.

Leaf-command help must include:

1. one-line purpose
2. usage line
3. required options
4. optional options
5. success output summary
6. at least one concrete example

Help writes to stdout and exits `0`.

### 8.3 Invalid usage behavior

Invalid usage is a contract, not an implementation detail.

CLI requirements:

- write a concise error block to stderr
- include `Error: <message>` on the first line
- include the relevant `Usage:` line
- include at least one `Example:` line
- include `See: orfe <group> <command> --help`
- exit with code `2`

Examples of invalid usage:

- unknown command
- missing required option
- mutually invalid option combination
- malformed `--repo`
- missing caller name for CLI mode

### 8.4 Success output contract

All successful leaf commands write JSON to stdout and exit `0`.

Runtime logging is separate from command output:

- `orfe` owns runtime logging through an internal logger abstraction
- default runtime log level is `error`
- CLI runtime logs write to stderr
- OpenCode runtime logs suppress non-error entries by default
- dependency and Octokit warnings must flow through that logger rather than ambient console behavior

Shared envelope:

```json
{
  "ok": true,
  "command": "issue get",
  "repo": "throw-if-null/orfe",
  "data": {}
}
```

### 8.5 Runtime failure contract

Valid commands that fail during execution write structured JSON to stderr and exit `1`.

Shared envelope:

```json
{
  "ok": false,
  "command": "issue get",
  "error": {
    "code": "github_not_found",
    "message": "Issue #13 was not found.",
    "retryable": false
  }
}
```

### 8.6 Stable error codes for v1

At minimum, v1 must use these stable codes where applicable:

- `invalid_usage`
- `invalid_input`
- `caller_context_missing`
- `caller_name_missing`
- `caller_name_unmapped`
- `config_not_found`
- `config_invalid`
- `auth_failed`
- `github_not_found`
- `github_conflict`
- `contract_not_found`
- `contract_invalid`
- `contract_validation_failed`
- `project_item_not_found`
- `project_status_field_not_found`
- `project_status_option_not_found`
- `not_implemented`

### 8.7 Idempotency rules

- `get` commands are read-only and idempotent.
- `get-or-create` is idempotent by its lookup key.
- `set-state` and `set-status` must succeed as no-ops when the target already has the requested value.
- comment/reply/review creation commands are not idempotent.
- plain `create` commands are not idempotent unless a later command explicitly defines otherwise.

## 9. OpenCode custom tool contract

The tool name is `orfe`.

### 9.1 Tool input shape

The wrapper accepts structured JSON input:

```json
{
  "command": "issue get",
  "issue_number": 13,
  "repo": "throw-if-null/orfe"
}
```

Rules:

- `command` is required.
- `command` uses the canonical space-separated vocabulary, matching the CLI subcommands exactly.
- command-specific fields use `snake_case`.
- body-contract selection uses `body_contract` in tool input when applicable.
- `caller_name` is **not** accepted from tool input.
- the wrapper injects `callerName` from `context.agent`.

### 9.2 Tool output

The wrapper returns the same structured success/error object shape produced by the core. The wrapper may translate thrown errors into the shared error envelope, but it must not redefine field names or introduce repo-specific semantics.

## 10. CLI command hierarchy

```text
orfe auth token

orfe runtime info

orfe issue get
orfe issue create
orfe issue update
orfe issue comment
orfe issue set-state

orfe pr get
orfe pr get-or-create
orfe pr comment
orfe pr submit-review
orfe pr reply

orfe project get-status
orfe project set-status
```

## 11. Command reference

## 11.1 `auth token`

**Purpose**: Mint a GitHub App installation token for the resolved caller bot and target repository.

**CLI**:

```text
orfe auth token --repo <owner/name> [--config <path>] [--auth-config <path>]
```

**Tool input**:

```json
{ "command": "auth token", "repo": "throw-if-null/orfe" }
```

**Success `data` shape**:

```json
{
  "bot": "greg",
  "app_slug": "GR3G-BOT",
  "repo": "throw-if-null/orfe",
  "token": "ghs_123",
  "expires_at": "2026-04-06T12:00:00Z",
  "auth_mode": "github-app"
}
```

Rules:

- the caller identity is resolved normally through CLI or wrapper caller resolution
- the command mints only for that resolved caller bot; it is not a cross-bot impersonation feature
- `repo` is required and must be `owner/name`
- `app_slug` is config-derived from the resolved bot auth metadata, not looked up live from GitHub
- the command must not silently fall back to session or ambient auth

**Side effects**: mints an installation token  
**Failure behavior**: unmapped caller => `caller_name_unmapped`; missing installation => `auth_failed`; config failures remain structured  
**Idempotency**: no

## 11.2 `issue get`

**Purpose**: Read one issue.

**CLI**:

```text
orfe issue get --issue-number <number> [--repo <owner/name>] [--config <path>]
```

**Tool input**:

```json
{ "command": "issue get", "issue_number": 13, "repo": "throw-if-null/orfe" }
```

**Success `data` shape**:

```json
{
  "issue_number": 13,
  "title": "Design the `orfe` custom tool and CLI contract",
  "body": "...",
  "state": "open",
  "state_reason": null,
  "labels": ["needs-input"],
  "assignees": ["greg"],
  "html_url": "https://github.com/throw-if-null/orfe/issues/13"
}
```

**Side effects**: none  
**Failure behavior**: `github_not_found` if the issue does not exist  
**Idempotency**: yes

## 11.3 `issue create`

**Purpose**: Create a generic issue.

**CLI**:

```text
orfe issue create --title <text> [--body <text>] [--body-contract <name@version>] [--label <name> ...] [--assignee <login> ...] [--repo <owner/name>] [--config <path>]
```

**Tool input**:

```json
{
  "command": "issue create",
  "title": "New issue title",
  "body": "Body text",
  "body_contract": "formal-work-item@1.0.0",
  "labels": ["needs-input"],
  "assignees": ["greg"]
}
```

Body-contract rules:

- `body_contract` is optional
- when provided, the body must validate against the selected issue contract
- when a provenance marker is already present in `body`, validation may use that marker even if `body_contract` is omitted
- when both explicit selection and provenance marker are present, they must match exactly
- successful validation appends or normalizes an HTML comment provenance marker in this form:

```html
<!-- orfe-body-contract: issue/<contract-name>@<version> -->
```

**Success `data` shape**:

```json
{
  "issue_number": 21,
  "title": "New issue title",
  "state": "open",
  "html_url": "https://github.com/throw-if-null/orfe/issues/21",
  "created": true
}
```

**Side effects**: creates a new issue  
**Failure behavior**: `auth_failed`, `config_invalid`, or GitHub API error mapping  
**Idempotency**: no

## 11.4 `issue update`

**Purpose**: Update mutable issue fields without changing open/closed state.

**CLI**:

```text
orfe issue update --issue-number <number> [--title <text>] [--body <text>] [--body-contract <name@version>] [--label <name> ...] [--assignee <login> ...] [--clear-labels] [--clear-assignees] [--repo <owner/name>] [--config <path>]
```

Rules:

- at least one mutation option is required
- provided labels replace the full label set
- provided assignees replace the full assignee set
- `--clear-labels` sets labels to `[]`
- `--clear-assignees` sets assignees to `[]`
- `--body-contract` does not count as a mutation by itself; it only constrains `--body` validation

Body-contract rules match `issue create`.

**Success `data` shape**:

```json
{
  "issue_number": 13,
  "title": "Updated title",
  "state": "open",
  "html_url": "https://github.com/throw-if-null/orfe/issues/13",
  "changed": true
}
```

**Side effects**: updates issue metadata  
**Failure behavior**: invalid field combinations => `invalid_usage`; missing issue => `github_not_found`  
**Idempotency**: yes when the requested state already matches the current issue state

## 11.5 `issue comment`

**Purpose**: Add a top-level issue comment.

**CLI**:

```text
orfe issue comment --issue-number <number> --body <text> [--repo <owner/name>] [--config <path>]
```

**Success `data` shape**:

```json
{
  "issue_number": 13,
  "comment_id": 123456,
  "html_url": "https://github.com/throw-if-null/orfe/issues/13#issuecomment-123456",
  "created": true
}
```

**Side effects**: creates a new comment  
**Failure behavior**: missing issue => `github_not_found`  
**Idempotency**: no

## 11.6 `issue set-state`

**Purpose**: Set issue open/closed state.

**CLI**:

```text
orfe issue set-state --issue-number <number> --state <open|closed> [--state-reason <completed|not_planned|duplicate>] [--duplicate-of <issue-number>] [--repo <owner/name>] [--config <path>]
```

Rules:

- `--state-reason` is valid only with `--state closed`
- `--duplicate-of` is valid only when `--state-reason duplicate`
- when `--state-reason duplicate` is used, `--duplicate-of` is required
- `--duplicate-of` refers to another issue number in the same repository
- `--duplicate-of` must not equal `--issue-number`
- v1 does not support cross-repository duplicate targets

Duplicate semantics are explicit and normative for v1:

- `orfe` must create GitHub's actual duplicate relationship
- it is **not** sufficient to only call REST issue update with `state=closed` and `state_reason=duplicate`
- the authoritative implementation path is Octokit GraphQL using `markIssueAsDuplicate`
- if the issue is already marked as a duplicate of a different canonical issue, `orfe` must first call Octokit GraphQL `unmarkIssueAsDuplicate`, then call `markIssueAsDuplicate` with the requested canonical issue
- after duplicate mutation, the command must return the observed canonical duplicate target in its success payload

Concrete implementation path for `--state closed --state-reason duplicate --duplicate-of <issue-number>`:

1. Use Octokit GraphQL to resolve the duplicate issue node ID and current `duplicateOf` relationship from `(owner, repo, issue_number)`.
2. Use Octokit GraphQL to resolve the canonical issue node ID from `(owner, repo, duplicate_of_issue_number)`.
3. If the canonical issue does not exist, fail with `github_not_found`.
4. If the duplicate issue is already marked duplicate of the requested canonical issue and is already closed, succeed as a no-op.
5. If the duplicate issue is marked duplicate of a different canonical issue, call Octokit GraphQL `unmarkIssueAsDuplicate` with the current canonical ID and duplicate issue ID.
6. Call Octokit GraphQL `markIssueAsDuplicate` with:
   - `duplicateId = <duplicate issue node id>`
   - `canonicalId = <canonical issue node id>`
7. Re-read the issue and verify:
   - `state = closed`
   - `state_reason = duplicate`
   - `duplicateOf.number = <duplicate-of issue number>`
8. If GitHub establishes the duplicate relationship but leaves close state unnormalized unexpectedly, `orfe` may perform a final Octokit REST issue update to normalize `state=closed` and `state_reason=duplicate`, then re-read again.

Concrete Octokit/API path:

- lookup/read steps: `octokit.graphql(...)`
- duplicate mutation step: `octokit.graphql(...)` with the GraphQL mutation `markIssueAsDuplicate(input: { duplicateId, canonicalId })`
- re-targeting step when needed: `octokit.graphql(...)` with the GraphQL mutation `unmarkIssueAsDuplicate(input: { duplicateId, canonicalId })`, followed by `markIssueAsDuplicate(...)`
- fallback normalization only if required: `octokit.rest.issues.update({ owner, repo, issue_number, state: "closed", state_reason: "duplicate" })`

Representative mutation shape:

```graphql
mutation MarkIssueAsDuplicate($duplicateId: ID!, $canonicalId: ID!) {
  markIssueAsDuplicate(
    input: {
      duplicateId: $duplicateId
      canonicalId: $canonicalId
    }
  ) {
    clientMutationId
  }
}
```

This means the duplicate relationship is the source of truth. The REST close operation is only a fallback normalization step, not the primary implementation path.

**Success `data` shape**:

```json
{
  "issue_number": 13,
  "state": "closed",
  "state_reason": "completed",
  "duplicate_of_issue_number": null,
  "changed": true
}
```

For duplicate closure, the success payload must instead include the canonical issue number:

```json
{
  "issue_number": 13,
  "state": "closed",
  "state_reason": "duplicate",
  "duplicate_of_issue_number": 7,
  "changed": true
}
```

**Side effects**: updates issue state  
**Failure behavior**: invalid combination => `invalid_usage`; missing duplicate target => `github_not_found`  
**Idempotency**: yes

## 11.7 `pr get`

**Purpose**: Read one pull request.

**CLI**:

```text
orfe pr get --pr-number <number> [--repo <owner/name>] [--config <path>]
```

**Success `data` shape**:

```json
{
  "pr_number": 9,
  "title": "Design the `orfe` custom tool and CLI contract",
  "body": "...",
  "state": "open",
  "draft": false,
  "head": "issues/orfe-13",
  "base": "main",
  "html_url": "https://github.com/throw-if-null/orfe/pull/9"
}
```

**Side effects**: none  
**Failure behavior**: missing PR => `github_not_found`  
**Idempotency**: yes

## 11.8 `pr get-or-create`

**Purpose**: Reuse an existing open PR for a branch pair or create one if none exists.

**CLI**:

```text
orfe pr get-or-create --head <branch> --title <text> [--body <text>] [--body-contract <name@version>] [--base <branch>] [--draft] [--repo <owner/name>] [--config <path>]
```

Rules:

- `--head` is required
- `--title` is required
- `--base` defaults to `repository.default_branch`
- lookup key is `(repo, head, base, state=open)`
- if one open PR matches, return it unchanged
- if more than one open PR matches, fail with `github_conflict`
- if none match, create a new PR

Body-contract rules:

- `body_contract` is optional
- when provided, the PR body must validate against the selected PR contract
- when a provenance marker is already present in `body`, validation may use that marker even if `body_contract` is omitted
- when both explicit selection and provenance marker are present, they must match exactly
- successful validation appends or normalizes an HTML comment provenance marker in this form:

```html
<!-- orfe-body-contract: pr/<contract-name>@<version> -->
```

**Success `data` shape**:

```json
{
  "pr_number": 9,
  "html_url": "https://github.com/throw-if-null/orfe/pull/9",
  "head": "issues/orfe-13",
  "base": "main",
  "draft": false,
  "created": false
}
```

**Side effects**: may create a PR  
**Failure behavior**: `github_conflict` if the lookup is ambiguous  
**Idempotency**: yes by lookup key

## 11.9 `pr comment`

**Purpose**: Add a top-level issue-style comment on a PR conversation.

**CLI**:

```text
orfe pr comment --pr-number <number> --body <text> [--repo <owner/name>] [--config <path>]
```

**Success `data` shape**:

```json
{
  "pr_number": 9,
  "comment_id": 123456,
  "html_url": "https://github.com/throw-if-null/orfe/pull/9#issuecomment-123456",
  "created": true
}
```

**Side effects**: creates a new top-level PR comment  
**Failure behavior**: missing PR => `github_not_found`  
**Idempotency**: no

## 11.10 `pr submit-review`

**Purpose**: Submit a completed PR review without line comments.

**CLI**:

```text
orfe pr submit-review --pr-number <number> --event <approve|request-changes|comment> --body <text> [--repo <owner/name>] [--config <path>]
```

Rules:

- `--event` maps to GitHub review events
- line-level review comments are not part of v1

**Success `data` shape**:

```json
{
  "pr_number": 9,
  "review_id": 555,
  "event": "approve",
  "submitted": true
}
```

**Side effects**: creates and submits a review  
**Failure behavior**: invalid `event` => `invalid_input`; missing PR => `github_not_found`  
**Idempotency**: no

## 11.11 `pr reply`

**Purpose**: Reply to an existing pull request review comment.

**CLI**:

```text
orfe pr reply --pr-number <number> --comment-id <number> --body <text> [--repo <owner/name>] [--config <path>]
```

**Success `data` shape**:

```json
{
  "pr_number": 9,
  "comment_id": 123999,
  "in_reply_to_comment_id": 123456,
  "created": true
}
```

**Side effects**: creates a reply comment on a PR review thread  
**Failure behavior**: missing PR or parent comment => `github_not_found`; invalid or non-repliable targets => `github_conflict`  
**Idempotency**: no

## 11.12 `project get-status`

**Purpose**: Read the current Status-field value for a project item.

**CLI**:

```text
orfe project get-status --item-type <issue|pr> --item-number <number> [--project-owner <login>] [--project-number <number>] [--status-field-name <name>] [--repo <owner/name>] [--config <path>]
```

Resolution order:

- `project_owner`: CLI option, else `projects.default.owner`, else error
- `project_number`: CLI option, else `projects.default.project_number`, else error
- `status_field_name`: CLI option, else `projects.default.status_field_name`, else literal `Status`

**Success `data` shape**:

```json
{
  "project_owner": "throw-if-null",
  "project_number": 2,
  "status_field_name": "Status",
  "status_field_id": "PVTSSF_lAHOABCD1234",
  "item_type": "issue",
  "item_number": 13,
  "project_item_id": "PVTI_lAHOABCD1234",
  "status_option_id": "f75ad846",
  "status": "In Progress"
}
```

**Side effects**: none  
**Failure behavior**: `project_item_not_found` if the item is not on the project; `project_status_field_not_found` if the configured Status field is missing on the project  
**Idempotency**: yes

## 11.13 `project set-status`

**Purpose**: Set the Status-field value for a project item.

**CLI**:

```text
orfe project set-status --item-type <issue|pr> --item-number <number> --status <value> [--project-owner <login>] [--project-number <number>] [--status-field-name <name>] [--repo <owner/name>] [--config <path>]
```

Rules:

- target field must be a single-select Status field
- requested status must match one of that field's configured option names exactly

**Success `data` shape**:

```json
{
  "project_owner": "throw-if-null",
  "project_number": 2,
  "status_field_name": "Status",
  "status_field_id": "PVTSSF_lAHOABCD1234",
  "item_type": "issue",
  "item_number": 13,
  "project_item_id": "PVTI_lAHOABCD1234",
  "status_option_id": "f75ad846",
  "status": "In Progress",
  "previous_status_option_id": "f75ad845",
  "previous_status": "Todo",
  "changed": true
}
```

**Side effects**: mutates project field state  
**Failure behavior**: `project_item_not_found` if the item is not on the project; `project_status_field_not_found` if the configured or overridden single-select status field does not exist on the project; invalid option => `project_status_option_not_found`  
**Idempotency**: yes

## 11.14 `runtime info`

**Purpose**: Inspect the currently executing `orfe` runtime through the supported command contract.

**CLI**:

```text
orfe runtime info
```

**Tool input**:

```json
{ "command": "runtime info" }
```

**Success `data` shape**:

```json
{
  "orfe_version": "0.4.0",
  "entrypoint": "opencode-plugin"
}
```

Rules:

- `orfe_version` must be read from `package.json` at runtime, not hardcoded
- `entrypoint` must be `cli` for CLI execution and `opencode-plugin` for plugin execution
- the command must not require caller identity, repo config, auth config, or GitHub access
- the command must not call GitHub

**Side effects**: none  
**Failure behavior**: package metadata load failures remain structured  
**Idempotency**: yes

## 12. Success/failure semantics for follow-up implementation

Issues #14 and #15 should assume these implementation constraints:

- core handlers return structured result objects
- handlers throw typed errors with stable codes
- CLI formatting is a thin adapter over core success/error objects
- custom tool formatting is also a thin adapter over the same core contract
- unimplemented leaf commands in early scaffolding must fail consistently with `not_implemented`

Placeholder behavior for stubs:

```json
{
  "ok": false,
  "command": "issue create",
  "error": {
    "code": "not_implemented",
    "message": "Command \"issue create\" is not implemented yet.",
    "retryable": false
  }
}
```

## 13. Testing strategy for v1 work

### 13.1 Required automated coverage direction

- contract tests for CLI structure and validation
- contract tests for wrapper/core separation
- config-loading tests
- caller-resolution tests
- command-handler tests for GitHub interactions

### 13.2 HTTP mocking approach

Command-level HTTP mocking must use `nock` against Octokit's outbound HTTP calls.

V1 explicitly does **not** require:

- a fake GitHub server
- a local GitHub clone service
- end-to-end live GitHub tests as a blocker for foundation or contract-test issues

### 13.3 E2E stance

End-to-end coverage is a later milestone. Lack of e2e coverage must not block #13.

## 14. Non-goals restated

This spec does not authorize `orfe` to own:

- repo-local workflow semantics or coordination policy
- repo-specific board state semantics beyond generic Status-field reads/writes
- branch naming policy
- worktree policy
- final review policy
- merge policy

Those concerns remain outside `orfe` and may call `orfe` as a lower-level primitive.
