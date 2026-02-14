# coding-usage

English | [简体中文](README.zh-CN.md)

Local-first quota and usage monitor for AI coding subscriptions and APIs.

## What you get

- One CLI to collect and view package usage across providers.
- Unified quota snapshots in a local SQLite database (`data/coding-usage.db`).
- Useful for mixed plans (monthly premium requests, rolling windows, balance/credits).

## Current providers (implemented)

- Codex
- Gemini
- Kimi
- GLM
- OpenRouter
- GitHub Copilot

## Quick start

### 1) Install dependencies and build

```bash
pnpm install
pnpm -r run build
```

### 2) Optional: initialize data directory

```bash
pnpm cli init
```

### 3) Configure credentials

Use either provider login flow:

```bash
pnpm cli auth login codex
pnpm cli auth login gemini
pnpm cli auth login kimi
pnpm cli auth login github-copilot
```

Or put keys/tokens into `.env.local` (recommended for local-only secrets).

### 4) Check configured providers

```bash
pnpm cli configured-providers
pnpm cli configured-providers --all --json
```

### 5) Collect and print usage in one command

```bash
pnpm cli usage
```

`usage` will refresh usage first, then print `Quota Status` with:

- Last refresh time
- Per-rule usage (`Used: x / y`)
- Per-rule update time

If you only want cached status without refresh:

```bash
pnpm cli usage --no-refresh
```

### 6) Start the web dashboard

Run API server and web app in two terminals:

```bash
# terminal A
pnpm daemon

# terminal B
pnpm dev
```

Open `http://127.0.0.1:5173`.

The web app reads status from `/status` and `/health` (proxied to `http://127.0.0.1:8787` in dev).

## Main CLI commands

- `pnpm cli usage` - refresh + show quota status
- `pnpm cli status` - show current cached quota status
- `pnpm cli collect` - run one collection round
- `pnpm cli collect --experimental` - include extra probing paths
- `pnpm cli providers` - list available providers
- `pnpm cli configured-providers` - list configured providers
- `pnpm cli auth status` - show token/key availability from `.env.local`

## Notes

- All data is local-first by default.
- Some provider paths rely on internal/undocumented endpoints and may change over time.
- If a provider does not appear in `Quota Status`, run `pnpm cli usage` once and check command output errors.

## Provider tracking docs

- English index: [docs/providers/README.md](docs/providers/README.md)
- Chinese index: [docs/providers/zh-CN/README.md](docs/providers/zh-CN/README.md)
- Per-provider docs include tracking paths, payload mapping, auth source priority, and fallback behavior.
- English provider docs:
  - [Codex](docs/providers/codex-tracking-and-auth.md)
  - [Gemini](docs/providers/gemini-tracking-and-auth.md)
  - [Kimi](docs/providers/kimi-tracking-and-auth.md)
  - [GLM](docs/providers/glm-tracking-and-auth.md)
  - [OpenRouter](docs/providers/openrouter-tracking-and-auth.md)
  - [GitHub Copilot](docs/providers/github-copilot-tracking-and-auth.md)
- Chinese provider docs:
  - [Codex（中文）](docs/providers/zh-CN/codex-tracking-and-auth.zh-CN.md)
  - [Gemini（中文）](docs/providers/zh-CN/gemini-tracking-and-auth.zh-CN.md)
  - [Kimi（中文）](docs/providers/zh-CN/kimi-tracking-and-auth.zh-CN.md)
  - [GLM（中文）](docs/providers/zh-CN/glm-tracking-and-auth.zh-CN.md)
  - [OpenRouter（中文）](docs/providers/zh-CN/openrouter-tracking-and-auth.zh-CN.md)
  - [GitHub Copilot（中文）](docs/providers/zh-CN/github-copilot-tracking-and-auth.zh-CN.md)

## License

MIT
