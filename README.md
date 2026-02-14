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

## Development docs

- `docs/plans/2026-02-13-coding-usage-monitor-design.md`
- `docs/plans/2026-02-13-coding-usage-implementation-plan.md`
- `docs/plans/2026-02-13-coding-usage-micro-checklist.md`

## License

MIT
