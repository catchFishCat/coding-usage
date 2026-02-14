# GLM Tracking and Auth

## Tracking details

- Official poller: `packages/core/src/adapters/polling/providers/glm/official.ts`
- Endpoint:
  - `GET <ZHIPU_BASE_URL or https://open.bigmodel.cn>/api/monitor/usage/quota/limit`
- Headers:
  - `Authorization: <ZHIPU_AUTH_TOKEN>` (already formatted; no Bearer prefix added)
  - `Accept-Language: en-US,en`
  - `Content-Type: application/json`
- Mapping:
  - Picks first `limits[]` item whose `type` contains `token`
  - Uses `percentage` as used value
  - Rule id: `glm-token-window`
  - Rule name: `GLM Token Window (5h)`
  - Snapshot: `used=<percentage>`, `limit=100`, fixed window

- Experimental probe: `packages/core/src/adapters/polling/providers/glm/experimental.ts`
  - Endpoint: `GET https://api.z.ai/api/monitor/usage/quota/limit`
  - Same headers as official
  - Reachability probe only, no snapshot writes

## Auth sources and priority

- Required:
  1. `ZHIPU_AUTH_TOKEN`

- Optional:
  - `ZHIPU_BASE_URL` for official endpoint base override

## Notes

- GLM tracking is percentage-based in this project (`limit=100`) and represents window usage percent instead of absolute request counts.
