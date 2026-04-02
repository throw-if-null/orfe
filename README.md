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
- caches tokens until near expiry, then refreshes automatically
- keeps each MCP session pinned to one role identity via `MCP-Session-Id`
- never logs tokens

## OpenCode MCP configuration

In OpenCode, replace any local container or static PAT-based GitHub MCP entry with a role-pinned local HTTP MCP entry that points at the proxy endpoint for the current role.

Example for Greg:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "github-greg": {
      "type": "http",
      "url": "http://127.0.0.1:8787/greg",
      "enabled": true,
      "timeout": 10000,
      "headers": {
        "X-MCP-Toolsets": "context,issues,pull_requests,projects"
      }
    }
  }
}
```

Use the matching role endpoint for each agent:

- Zoran → `/zoran`
- Jelena → `/jelena`
- Greg → `/greg`
- Klarissa → `/klarissa`

The proxy handles GitHub App auth locally, so OpenCode should not provide a static GitHub PAT to the remote GitHub MCP server in this setup.

### Expected `~/.config/opencode/opencode.json`

The local OpenCode config is machine-local and should not be committed. Configure one GitHub MCP entry per role and point each entry at the local proxy instead of `https://api.githubcopilot.com/mcp/`.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "context7": {
      "type": "local",
      "command": ["npx", "-y", "@upstash/context7-mcp"]
    },
    "github-zoran": {
      "type": "http",
      "url": "http://127.0.0.1:8787/zoran",
      "headers": {
        "X-MCP-Toolsets": "context,issues,pull_requests,projects"
      },
      "enabled": true,
      "timeout": 10000
    },
    "github-jelena": {
      "type": "http",
      "url": "http://127.0.0.1:8787/jelena",
      "headers": {
        "X-MCP-Toolsets": "context,issues,pull_requests,projects"
      },
      "enabled": true,
      "timeout": 10000
    },
    "github-greg": {
      "type": "http",
      "url": "http://127.0.0.1:8787/greg",
      "headers": {
        "X-MCP-Toolsets": "context,issues,pull_requests,projects"
      },
      "enabled": true,
      "timeout": 10000
    },
    "github-klarissa": {
      "type": "http",
      "url": "http://127.0.0.1:8787/klarissa",
      "headers": {
        "X-MCP-Toolsets": "context,issues,pull_requests,projects"
      },
      "enabled": true,
      "timeout": 10000
    }
  }
}
```

### Local agent auth workflow

Role mapping must stay consistent across `AGENTS.md`, `~/.config/tokenner/apps.yaml`, and the OpenCode MCP entries:

- `zoran` → `Z0R4N-BOT`
- `jelena` → `J3L3N4-BOT`
- `greg` → `GR3G-BOT`
- `klarissa` → `KL4R1554-BOT`

For normal local use:

1. Build the project with `npm run build`.
2. Start the proxy with `npm run proxy` (or `node dist/cli.js proxy --repo throw-if-null/orfe`).
3. Use the matching role-specific OpenCode MCP entry.
4. For `gh` CLI writes, mint a fresh token first and pass it with `GH_TOKEN`.

### `gh` CLI auth for agents

Agents should not rely on a static PAT or implicit session auth for GitHub writes. Mint a role token first, then run `gh` with `GH_TOKEN` set for that command only.

Greg example:

```bash
TOKEN=$(node dist/cli.js token --role greg --repo throw-if-null/orfe | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).token)")
GH_TOKEN="$TOKEN" gh issue comment 5 --repo throw-if-null/orfe --body "smoke test from greg"
```

If token minting fails, stop and fix bot auth. Do not silently fall back to session auth.

### Manual smoke testing

You can validate each role manually with the built CLI:

```bash
TOKEN=$(node dist/cli.js token --role zoran --repo throw-if-null/orfe | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).token)")
GH_TOKEN="$TOKEN" gh api user
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
