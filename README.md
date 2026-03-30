# tokenner

`tokenner` is a local CLI for minting short-lived auth tokens for agents. v1 supports GitHub App installation tokens through a provider-based architecture so additional auth providers can be added later.

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

## Development

```bash
npm test
npm run lint
npm run typecheck
npm run build
```
