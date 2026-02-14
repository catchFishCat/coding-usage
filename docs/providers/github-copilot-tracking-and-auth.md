# GitHub Copilot Tracking and Auth

## Tracking details

- Official poller: `packages/core/src/adapters/polling/providers/github-copilot/official.ts`
- Endpoint:
  - `GET https://api.github.com/copilot_internal/user`
- Required headers:
  - `Authorization: token <token>`
  - `User-Agent: coding-usage`
  - `Accept: application/json`

- Raw fields consumed:
  - `copilot_plan`
  - `access_type_sku`
  - `quota_reset_date_utc`
  - `quota_snapshots.premium_interactions.entitlement`
  - `quota_snapshots.premium_interactions.remaining`
  - `quota_snapshots.premium_interactions.unlimited`

- Mapping:
  - If `unlimited=true` (or entitlement resolves to 0): record usage payload and return success message, no quota snapshot created
  - Else:
    - `limit = entitlement`
    - `used = max(0, entitlement - remaining)`
    - Rule id: `github-copilot-premium-monthly`
    - Rule type: fixed window
    - Unit: requests

## Auth sources and priority

- Token resolution order:
  1. `GITHUB_COPILOT_TOKEN`
  2. `GITHUB_TOKEN`
  3. Auto-discovered from `~/.local/share/opencode/auth.json`
     - `github-copilot.access`
     - fallback `github-copilot.refresh`

- Config visibility helper:
  - `packages/cli/src/commands/configured-providers.ts` exposes an extra signal `OPENCODE_GITHUB_COPILOT` when token exists in opencode auth.

## Notes

- This implementation tracks monthly premium interactions when entitlement is finite.
- Plan/SKU metadata is preserved in stored payload and included in poll messages when present.
