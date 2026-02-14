# Gemini Tracking and Auth

## Tracking details

- Official poller: `packages/core/src/adapters/polling/providers/gemini/official.ts`
- Primary quota flow (Cloud Code Assist):
  1. `POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`
  2. `POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota`
- Quota mapping from `retrieveUserQuota.buckets[]`:
  - For each bucket with `modelId` and `remainingFraction`
  - `usedPercent = (1 - remainingFraction) * 100`
  - Rule id format: `gemini-<normalized-model-id>`
  - Snapshot stored as `used=usedPercent`, `limit=100`
  - Obsolete model rules are pruned via `pruneProviderRules`

- Cached fallback flow (no API key and no OAuth token):
  - Reads `~/.config/opencode/antigravity-accounts.json`
  - Uses `accounts[].cachedQuota`
  - Converts `remainingFraction` to percent-used snapshots

- Reachability fallback flow:
  - Endpoint: `GET https://generativelanguage.googleapis.com/v1beta/models`
  - Used when quota endpoints are unavailable but token/key still works
  - Stores usage record only (no quota snapshots)

## Auth sources and priority

- Top-level auth selection:
  1. `GEMINI_API_KEY` (if set, used for reachability API path)
  2. OAuth token resolution path (below)

- OAuth token resolution priority:
  1. `GOOGLE_OAUTH_ACCESS_TOKEN`
  2. `~/.local/share/opencode/auth.json` -> `google.access` (if unexpired)
  3. Refresh using `google.refresh` from opencode auth
  4. Refresh using token from `~/.config/opencode/antigravity-accounts.json`
  5. `gcloud auth application-default print-access-token` (`GCLOUD_CLI_PATH` optional override)

- OAuth client credentials used for refresh grant:
  1. ADC file candidates:
     - `%APPDATA%/gcloud/application_default_credentials.json` (Windows)
     - `~/.config/gcloud/application_default_credentials.json`
  2. Env fallback:
     - `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
     - `ANTIGRAVITY_GOOGLE_CLIENT_ID` / `ANTIGRAVITY_GOOGLE_CLIENT_SECRET`

- Project id resolution for quota call:
  1. Embedded in refresh value `refreshToken|projectId`
  2. `managedProjectId` or `projectId` from antigravity accounts
  3. `cloudaicompanionProject` returned by `loadCodeAssist`

## Notes

- This provider supports both API-key and OAuth-based collection.
- Best quota fidelity comes from Cloud Code Assist quota endpoints, not the generic models endpoint.
