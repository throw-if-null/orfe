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

In OpenCode, replace any local container or static PAT-based GitHub MCP entry with a Streamable HTTP server pointing at the local proxy endpoint for the current role.

Example for Greg:

```json
{
  "mcpServers": {
    "github": {
      "transport": {
        "type": "streamable-http",
        "url": "http://127.0.0.1:8787/greg"
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

## Development

```bash
npm test
npm run lint
npm run typecheck
npm run build
```
