# orfe

`orfe` is a stand-alone GitHub operations runtime with two entrypoints:

- an installable CLI named `orfe`
- an OpenCode custom tool wrapper also named `orfe`

Issue #14 builds the shared foundation only. The V1 leaf commands are registered and routed, but command behavior is intentionally stubbed until follow-up issues implement real GitHub operations.

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

1. `--caller-name <value>`
2. `ORFE_CALLER_NAME=<value>`
3. fail with invalid usage

Successful commands print structured JSON to stdout. Stubbed commands currently fail with a structured `not_implemented` error envelope on stderr.

## Contract-test workflow for later implementation issues

Issue #15 keeps trunk green by committing the command contracts in a non-breaking stub form.

When a later issue implements a leaf command:

1. keep the CLI shape, help text, and validation contract green
2. update the command handler to return the documented `successDataExample` shape for real executions
3. replace the placeholder `not_implemented` expectation only in tests that target that leaf command's runtime behavior
4. keep shared wrapper/core, config, auth, and error-contract tests green
5. add `nock`-backed command tests for the Octokit calls introduced by that implementation

The contract source of truth for each leaf command lives in:

- `src/command-registry.ts` for discovery/help/validation
- `src/command-contracts.ts` for expected success payload shapes and valid stub inputs
- `test/*.test.ts` for CLI, wrapper, config, auth, and placeholder behavior contracts

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
