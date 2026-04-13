# orfe

`orfe` is a stand-alone GitHub operations runtime with two entrypoints:

- an installable CLI named `orfe`
- an OpenCode custom tool wrapper also named `orfe`

`orfe` now ships the full v1 command surface. When repo-local config and machine-local GitHub App auth are in place, the CLI and OpenCode wrapper execute the documented GitHub operations directly.

## Install the npm CLI package

`orfe` can currently be installed from a locally built npm package artifact.

- Supported now: package artifact installs created with `npm pack`
- Not included yet: npm registry publication, release automation, or public-registry `npx orfe`

Build the package artifact from the repo root:

```bash
npm pack
```

That command runs the package `prepack` build and writes `orfe-<version>.tgz`.

### Local install from the package artifact

Install the tarball into another project directory:

```bash
npm install /absolute/path/to/orfe-<version>.tgz
PATH="$(pwd)/node_modules/.bin:$PATH" orfe --help
```

### Global install from the package artifact

Install the same tarball globally:

```bash
npm install --global /absolute/path/to/orfe-<version>.tgz
orfe --help
```

### Install boundary notes

Package installation is separate from the other setup steps in this repo:

- **Package installation** puts the `orfe` executable on disk
- **npm publication/release automation** is not configured by this repository yet
- **Repo-local config** is still a separate step for repositories that want to run GitHub commands through `orfe`
- **Machine-local auth config** is still a separate step for machines that need GitHub App auth

`orfe --help` works immediately after installation. Commands that talk to GitHub still require the repo-local and machine-local configuration described below.

## Documentation

Canonical product and architecture memory now lives under `docs/`.
Start with `docs/README.md` for the documentation map and authoritative entrypoints.
For operational workflow structure, also see `docs/project/handoffs.md`.

## Requirements

- Node.js 22+
- repo-local config at `.orfe/config.json` for GitHub-command execution
- machine-local GitHub App auth config at `~/.config/orfe/auth.json` for GitHub-command execution

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
  "caller_to_github_role": {
    "Greg": "greg",
    "Jelena": "jelena",
    "Zoran": "zoran",
    "Klarissa": "klarissa"
  },
  "projects": {
    "default": {
      "owner": "throw-if-null",
      "project_number": 1,
      "status_field_name": "Status"
    }
  }
}
```

## Machine-local auth config

Default path:

```text
~/.config/orfe/auth.json
```

Example:

```json
{
  "version": 1,
  "roles": {
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

Leaf help:

```bash
orfe issue get --help
```

CLI caller resolution order:

1. `ORFE_CALLER_NAME=<value>`
2. fail with invalid usage

Successful commands print structured JSON to stdout. Valid commands that fail at runtime print structured JSON errors to stderr.

## OpenCode wrapper

The custom tool wrapper lives at `.opencode/tools/orfe.ts`.

- the wrapper reads `context.agent`
- the wrapper resolves a plain `callerName`
- the wrapper passes only plain data into the runtime core
- the core does not read `context.agent`

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
