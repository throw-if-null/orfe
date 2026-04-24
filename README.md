# orfe

`orfe` is a stand-alone GitHub operations runtime with two entrypoints:

- an installable CLI named `orfe`
- an OpenCode plugin that registers the `orfe` tool

`orfe` now ships the full v1 command surface. When repo-local config and machine-local GitHub App bot auth are in place, the CLI and OpenCode wrapper execute the documented GitHub operations directly.

## Install the npm CLI package

### Install from npm

```bash
npm install @mirzamerdovic/orfe
```

### Or run directly with npx

```bash
npx @mirzamerdovic/orfe --help
```

`orfe` can also be installed from a locally built npm package artifact for development.

- Supported now: package artifact installs created with `npm pack`
- Primary public distribution: npm registry via `@mirzamerdovic/orfe`
- Supported invocation path: `npx @mirzamerdovic/orfe`

Build the package artifact from the repo root:

```bash
npm pack
```

That command runs the package `prepack` build and writes `mirzamerdovic-orfe-<version>.tgz`.

### Local install from the package artifact

Install the tarball into another project directory:

```bash
npm install /absolute/path/to/mirzamerdovic-orfe-<version>.tgz
```

### Global install from the package artifact

Install the same tarball globally:

```bash
npm install --global /absolute/path/to/mirzamerdovic-orfe-<version>.tgz
orfe --help
```

### Install boundary notes

Package installation is separate from the other setup steps in this repo:

- **Package installation** puts the `orfe` executable on disk
- **npm publication/release automation** publishes tagged releases to npmjs.org
- **Repo-local config** is still a separate step for repositories that want to run GitHub commands through `orfe`
- **Machine-local auth config** is still a separate step for machines that need GitHub App auth

`orfe --help` works immediately after installation. Commands that talk to GitHub still require the repo-local and machine-local configuration described below.

## Documentation

Canonical product and architecture memory now lives under `docs/`.
Start with `docs/README.md` for the documentation map and authoritative entrypoints.
Agents using the packaged OpenCode `orfe` tool should start with `docs/orfe/opencode-tool-usage.md`.
The package-root `llms.txt` is a lightweight discovery pointer to that canonical tool-usage doc.
For operational workflow structure, also see `docs/project/handoffs.md`.

## Requirements

- Node.js 22+
- repo-local config at `.orfe/config.json` for GitHub-command execution
- machine-local GitHub App bot auth config at `~/.config/orfe/auth.json` for GitHub-command execution

## Repo-local config

Default path:

```text
.orfe/config.json
```

Example:

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

For this repository, the default GitHub Project is `Orfe` and its current project number is `2`.

Repo-defined issue and PR body contracts live separately under:

```text
.orfe/contracts/issues/
.orfe/contracts/pr/
```

These versioned JSON artifacts are declarative runtime inputs for issue/PR body validation and provenance. They are not part of `.orfe/config.json`.

## Machine-local auth config

Default path:

```text
~/.config/orfe/auth.json
```

Example:

```json
{
  "version": 1,
  "bots": {
    "greg": {
      "provider": "github-app",
      "app_id": 123458,
      "app_slug": "GR3G-BOT",
      "private_key_path": "~/.config/orfe/keys/greg.pem"
    }
  }
}
```

## CLI usage

Root help:

```bash
orfe --help
```

Structured runtime help:

```bash
orfe help
orfe help --command-name "issue get"
```

These commands return the normal structured success envelope and do not require `ORFE_CALLER_NAME`, repo-local config, machine-local auth config, or GitHub access.

Inspect the active runtime version and entrypoint:

```bash
orfe runtime info
```

This command does not require `ORFE_CALLER_NAME`, repo-local config, machine-local auth config, or GitHub access.

Leaf help:

```bash
orfe issue get --help
```

CLI caller resolution order:

1. `ORFE_CALLER_NAME=<value>`
2. fail with invalid usage

Successful commands print structured JSON to stdout. Valid commands that fail at runtime print structured JSON errors to stderr.

Runtime dependency logging is internal to `orfe`:

- default log level is `error`
- CLI runtime logs write to stderr
- OpenCode plugin runtime logs only surface errors by default
- set `ORFE_LOG_LEVEL=warn|info|debug` to raise verbosity for local troubleshooting

## OpenCode plugin

For packaged agent-facing tool guidance, use `docs/orfe/opencode-tool-usage.md`.

Configure OpenCode to load the packaged plugin directly:

```json
{
  "plugin": ["."]
}
```

- the plugin reads `context.agent`
- the plugin resolves a plain `callerName`
- the plugin passes only plain data into the runtime core
- the core does not read `context.agent`

To inspect the active runtime version through the plugin/tool contract:

```json
{
  "command": "runtime info"
}
```

Successful output includes the active `orfe_version` and the current `entrypoint` (`cli` or `opencode-plugin`).

To discover the tool command surface or request help for one command through structured output:

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

The top-level `help` command is available without caller context, repo-local config, machine-local auth config, or GitHub access.

## Development

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## CI

Fast CI runs on pull requests to `main` and on pushes to `main`.
It installs dependencies with `npm ci` using the npm cache and runs:

- `npm test`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
