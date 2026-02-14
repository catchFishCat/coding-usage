# Kimi Tracking and Auth

## Tracking details

- Official poller: `packages/core/src/adapters/polling/providers/kimi/official.ts`
- Primary usage endpoint:
  - `GET https://api.kimi.com/coding/v1/usages`
  - Parses `usage` summary and `limits[]` windows
- Numeric mapping rules:
  - If `used` missing but `limit` and `remaining` exist, derive `used = limit - remaining`
  - Weekly summary rule id: `kimi-coding-weekly`
  - Window rules use duration/timeUnit labels, for example `kimi-coding-5h`
  - Snapshot shape: fixed window, `unit=requests`, `used=<numeric>`, `limit=<numeric>`

- Legacy fallback when coding endpoint token is unauthorized:
  - `GET <MOONSHOT_BASE_URL or https://api.moonshot.cn>/v1/users/me/balance`
  - Stores payload as usage record, returns balance info

- Console-session fallback:
  - `POST https://www.kimi.com/apiv2/kimi.gateway.billing.v1.BillingService/GetUsages`
  - Body: `{ "scope": ["FEATURE_CODING"] }`
  - Stores payload; currently used mainly as fallback visibility path

- Experimental probe: `packages/core/src/adapters/polling/providers/kimi/experimental.ts`
  - Tests console endpoint first if `KIMI_CONSOLE_SESSION_TOKEN` exists
  - Then tests `https://api.kimi.com/coding/v1/usages`
  - Final fallback probe to `https://api.moonshot.ai/v1/users/me/balance`

## Auth sources and priority

- Official polling key/session priority:
  1. `KIMI_CODE_API_KEY`
  2. `MOONSHOT_API_KEY`
  3. Auto-discovered key from `~/.local/share/opencode/auth.json`
     - prefers `kimi-for-coding.key`
     - fallback `moonshotai-cn.key`
  4. `KIMI_CONSOLE_SESSION_TOKEN` (console fallback path)

- Additional host/base configuration:
  - `MOONSHOT_BASE_URL` overrides legacy Moonshot balance host (`https://api.moonshot.cn` default)

- CLI login auto-discovery path: `packages/cli/src/commands/auth.ts`
  - Runs `kimi login` (or `python -m kimi_cli login` fallback)
  - Attempts keyring extraction via Python snippet
  - Saves discovered token to `.env.local` as `KIMI_CONSOLE_SESSION_TOKEN`

## Notes

- The project prioritizes Kimi For Coding endpoint (`api.kimi.com/coding/v1/usages`) for real package usage.
- Legacy Moonshot balance endpoints are retained as compatibility fallbacks.
