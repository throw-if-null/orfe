# tokenner

`tokenner` is a local Node/TypeScript auth core plus CLI for minting short-lived auth tokens for agents. v1 supports GitHub App installation tokens through a provider-based architecture so additional auth providers can be added later, and includes a local GitHub MCP proxy with role-pinned endpoints.

## Requirements

- Node.js 22+
- A local config file with GitHub App credentials for each role you want to use

## Config path

By default `tokenner` reads config from:

```text
~/.config/tokenner/apps.yaml
```

You can override that for local testing with:

```bash
TOKENNER_CONFIG_PATH=/path/to/apps.yaml tokenner token --role greg --repo throw-if-null/orfe --format json
```

## Config format

```yaml
apps:
  zoran:
    provider: github-app
    app_id: 123456
    app_slug: Z0R4N-BOT
    private_key_path: ~/.config/tokenner/keys/zoran.pem
  jelena:
    provider: github-app
    app_id: 123457
    app_slug: J3L3N4-BOT
    private_key_path: ~/.config/tokenner/keys/jelena.pem
  greg:
    provider: github-app
    app_id: 123458
    app_slug: GR3G-BOT
    private_key_path: ~/.config/tokenner/keys/greg.pem
  klarissa:
    provider: github-app
    app_id: 123459
    app_slug: KL4R1554-BOT
    private_key_path: ~/.config/tokenner/keys/klarissa.pem
```

Notes:

- `provider` currently supports `github-app` only and defaults to `github-app` when omitted.
- The config file and private key files are local-only and must not be committed.
- `private_key_path` may use `~` and is expanded at runtime.

## Usage

Build the CLI:

```bash
npm install
npm run build
```

Request a token:

```bash
tokenner token --role greg --repo throw-if-null/orfe --format json
```

Successful output is JSON on stdout only:

```json
{
  "token": "ghs_...",
  "expires_at": "2026-03-30T21:30:00Z",
  "role": "greg",
  "app_slug": "GR3G-BOT",
  "repo": "throw-if-null/orfe",
  "auth_mode": "github-app"
}
```

On failure the command exits non-zero and writes the error to stderr only.

## Local GitHub MCP proxy

Start the local proxy:

```bash
tokenner proxy --repo throw-if-null/orfe --host 127.0.0.1 --port 8787
```

The proxy binds to loopback only and exposes one endpoint per role:

- `http://127.0.0.1:8787/zoran`
- `http://127.0.0.1:8787/jelena`
- `http://127.0.0.1:8787/greg`
- `http://127.0.0.1:8787/klarissa`

Behavior:

- forwards requests to `https://api.githubcopilot.com/mcp/`
- mints or reuses a fresh GitHub App installation token for the pinned role
- injects `Authorization: Bearer <installation-token>` on the outbound request
- injects the standard GitHub MCP `X-MCP-Toolsets: context,issues,pull_requests,projects` header on the outbound request
- caches tokens until near expiry, then refreshes automatically
- keeps each MCP session pinned to one role identity via `MCP-Session-Id`
- never logs tokens

## OpenCode MCP configuration

In OpenCode, replace any local container or direct remote GitHub MCP entry with a role-pinned local MCP entry that points at the proxy endpoint for the current role.

Example for Greg:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "github-greg": {
      "type": "remote",
      "url": "http://127.0.0.1:8787/greg"
    }
  }
}
```

Use the matching role endpoint for each agent:

- Zoran → `/zoran`
- Jelena → `/jelena`
- Greg → `/greg`
- Klarissa → `/klarissa`

The proxy handles GitHub App auth and the standard upstream GitHub MCP headers locally, so OpenCode should not provide a PAT, custom MCP headers, or a separate direct GitHub MCP entry in this setup.

### Expected `~/.config/opencode/opencode.json`

The local OpenCode config is machine-local and should not be committed. Configure one GitHub MCP entry per role and point each entry at the local proxy instead of `https://api.githubcopilot.com/mcp/`.

OpenCode's published schema currently accepts local HTTP MCP entries as `type: "remote"` with just a `url`. The shorter shape below was validated two ways for this issue:

- against the published schema from `https://opencode.ai/config.json`
- by loading the same shape through `opencode debug config`

Minimal supported example:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "context7": {
      "type": "local",
      "command": ["npx", "-y", "@upstash/context7-mcp"]
    },
    "github-zoran": {
      "type": "remote",
      "url": "http://127.0.0.1:8787/zoran"
    },
    "github-jelena": {
      "type": "remote",
      "url": "http://127.0.0.1:8787/jelena"
    },
    "github-greg": {
      "type": "remote",
      "url": "http://127.0.0.1:8787/greg"
    },
    "github-klarissa": {
      "type": "remote",
      "url": "http://127.0.0.1:8787/klarissa"
    }
  }
}
```

Do not also configure a separate direct GitHub MCP server entry in OpenCode when using these local proxy endpoints.

### Local agent auth workflow

Role mapping must stay consistent across `AGENTS.md`, `~/.config/tokenner/apps.yaml`, and the OpenCode MCP entries:

- `zoran` → `Z0R4N-BOT`
- `jelena` → `J3L3N4-BOT`
- `greg` → `GR3G-BOT`
- `klarissa` → `KL4R1554-BOT`

For normal local use:

1. Build the project with `npm run build`.
2. Start the proxy with `npm run proxy` (or `node dist/cli.js proxy --repo throw-if-null/orfe`).
3. Use only the matching role-specific OpenCode MCP entry.
4. For `gh` CLI writes, mint a fresh token first and pass it with `GH_TOKEN`.

### Validation notes for OpenCode config

Schema and config loading checks used for this repository:

```bash
python - <<'PY'
import json
import requests
import jsonschema

config = {
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "github-greg": {
      "type": "remote",
      "url": "http://127.0.0.1:8787/greg"
    }
  }
}

schema = requests.get(
  "https://opencode.ai/config.json",
  headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
  timeout=30,
).json()
jsonschema.validate(config, schema)
print("schema ok")
PY

OPENCODE_CONFIG_CONTENT='{"$schema":"https://opencode.ai/config.json","mcp":{"github-greg":{"type":"remote","url":"http://127.0.0.1:8787/greg"}}}' \
  opencode debug config
```

`opencode debug config` is a deterministic way to prove OpenCode accepts and resolves the config shape. A full interactive session load and live MCP tool invocation may still require a human runtime check depending on the environment where OpenCode is launched.

### `gh` CLI auth for agents

Agents should not rely on a static PAT or implicit session auth for GitHub writes. Mint a role token first, then run `gh` with `GH_TOKEN` set for that command only.

Greg example:

```bash
TOKEN=$(node dist/cli.js token --role greg --repo throw-if-null/orfe | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).token)")
GH_TOKEN="$TOKEN" gh issue comment 5 --repo throw-if-null/orfe --body "smoke test from greg"
```

If token minting fails, stop and fix bot auth. Do not silently fall back to session auth.

### Manual smoke testing

You can validate each role manually with the built CLI by making a repo-scoped request that installation tokens are allowed to perform:

```bash
TOKEN=$(node dist/cli.js token --role zoran --repo throw-if-null/orfe | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).token)")
GH_TOKEN="$TOKEN" gh api repos/throw-if-null/orfe/issues/5 --jq '.title'
```

Or post an issue comment to verify the visible bot identity end to end:

```bash
TOKEN=$(node dist/cli.js token --role klarissa --repo throw-if-null/orfe | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).token)")
GH_TOKEN="$TOKEN" gh issue comment 5 --repo throw-if-null/orfe --body "smoke test from klarissa"
```

## Development

```bash
npm test
npm run lint
npm run typecheck
npm run build
```
