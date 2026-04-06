# orfe

`orfe` is a stand-alone GitHub operations runtime with two entrypoints:

- an installable CLI named `orfe`
- an OpenCode custom tool wrapper also named `orfe`

Issue #14 builds the shared foundation only. The V1 leaf commands are registered and routed, but command behavior is intentionally stubbed until follow-up issues implement real GitHub operations.

## Requirements

- Node.js 22+
- repo-local config at `.orfe/config.json`
- machine-local GitHub App auth config at `~/.config/orfe/auth.json`

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
