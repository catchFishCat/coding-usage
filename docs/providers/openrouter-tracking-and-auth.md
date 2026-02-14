# OpenRouter Tracking and Auth

## Tracking details

- Official poller: `packages/core/src/adapters/polling/providers/openrouter/official.ts`
- Endpoint:
  - `GET https://openrouter.ai/api/v1/key`
- Requirement:
  - `OPENROUTER_API_KEY`
- Raw fields consumed:
  - `data.usage`
  - `data.limit`
- Mapping:
  - Rule id: `openrouter-credits-balance`
  - Rule type: `balance`
  - Unit: `credits`
  - Snapshot: `used=<usage>`, `limit=<limit>`
  - Raw payload persisted through `insertUsageRecord`

## Auth sources and priority

- Required:
  1. `OPENROUTER_API_KEY`

- No local auth-file auto-discovery path is implemented for OpenRouter in current code.

## Notes

- OpenRouter is tracked as credits/balance, not request-window quotas.
