# Codex Tracking and Auth

## Tracking details

- Official poller: `packages/core/src/adapters/polling/providers/codex/official.ts`
- Endpoint: `GET https://api.openai.com/v1/organization/usage/completions?start_time=<unix-seconds-24h-ago>`
- Requirement: `OPENAI_ADMIN_KEY`
- Raw fields consumed:
  - `data[].num_model_requests`
  - `data[].input_tokens`
  - `data[].output_tokens`
- Current official output:
  - Stores raw payload via `insertUsageRecord(db, "codex", "api", payload)`
  - Returns summary message with total requests/tokens
  - Does not create quota rule snapshots in official mode

- Experimental probe: `packages/core/src/adapters/polling/providers/codex/experimental.ts`
- Endpoint: `GET https://chatgpt.com/backend-api/wham/usage`
- Raw fields consumed:
  - `plan_type`
  - `rate_limit.primary_window.used_percent` (mapped to 5h rule)
  - `rate_limit.secondary_window.used_percent` (mapped to 7d rule)
- Experimental snapshot mapping:
  - `codex-primary-window-5h` -> `used=<used_percent>`, `limit=100`
  - `codex-secondary-window-7d` -> `used=<used_percent>`, `limit=100`

## Auth sources and priority

- Official mode:
  1. `OPENAI_ADMIN_KEY` (required)

- Experimental mode:
  1. `CHATGPT_SESSION_TOKEN` (preferred when present)
  2. `OPENAI_OAUTH_ACCESS_TOKEN` (fallback)
  3. Optional `OPENAI_ACCOUNT_ID` adds `chatgpt-account-id` header

- Auth auto-discovery (CLI login path): `packages/cli/src/commands/auth.ts`
  - Reads Codex auth JSON from:
    - `~/.codex/auth.json`
    - `~/.config/codex/auth.json`
  - Writes discovered values into local `.env.local`

## Notes

- Codex private usage polling depends on ChatGPT web/session behavior and can change without notice.
- `codexOAuthFeasibility()` documents that OAuth scope support for private usage is not guaranteed.
