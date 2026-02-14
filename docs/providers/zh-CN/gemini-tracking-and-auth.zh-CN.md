# Gemini 追踪与鉴权

## 用量追踪细节

- Official 轮询器：`packages/core/src/adapters/polling/providers/gemini/official.ts`
- 主要配额链路（Cloud Code Assist）：
  1. `POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`
  2. `POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota`
- 配额映射（`retrieveUserQuota.buckets[]`）：
  - 当 bucket 含 `modelId` 与 `remainingFraction` 时
  - `usedPercent = (1 - remainingFraction) * 100`
  - 规则 id：`gemini-<规范化model-id>`
  - 快照写入：`used=usedPercent`, `limit=100`
  - 过期 model 规则通过 `pruneProviderRules` 清理

- 无 API key 且无 OAuth token 时的缓存回退：
  - 读取 `~/.config/opencode/antigravity-accounts.json`
  - 使用 `accounts[].cachedQuota`
  - 将 `remainingFraction` 转换为 percent-used 快照

- 可达性回退：
  - `GET https://generativelanguage.googleapis.com/v1beta/models`
  - 当 quota 接口不可用但鉴权仍可用时使用
  - 仅写 usage record，不写 quota 快照

## 鉴权来源与优先级

- 顶层鉴权选择：
  1. `GEMINI_API_KEY`（若存在，走 API key 可达性链路）
  2. 否则进入 OAuth token 解析链路

- OAuth token 解析优先级：
  1. `GOOGLE_OAUTH_ACCESS_TOKEN`
  2. `~/.local/share/opencode/auth.json` 中的 `google.access`（且未过期）
  3. 使用 opencode 中 `google.refresh` 走 refresh grant 刷新
  4. 使用 `~/.config/opencode/antigravity-accounts.json` 中 refresh token 刷新
  5. `gcloud auth application-default print-access-token`（可通过 `GCLOUD_CLI_PATH` 覆盖）

- Refresh grant 的客户端凭据来源：
  1. ADC 文件：
     - `%APPDATA%/gcloud/application_default_credentials.json`（Windows）
     - `~/.config/gcloud/application_default_credentials.json`
  2. 环境变量回退：
     - `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
     - `ANTIGRAVITY_GOOGLE_CLIENT_ID` / `ANTIGRAVITY_GOOGLE_CLIENT_SECRET`

- quota 请求 projectId 解析顺序：
  1. `refreshToken|projectId` 中携带的 projectId
  2. antigravity account 的 `managedProjectId` 或 `projectId`
  3. `loadCodeAssist` 返回的 `cloudaicompanionProject`

## 说明

- Gemini 在本项目中同时支持 API key 与 OAuth 两套路径。
- 最完整的配额数据来自 Cloud Code Assist quota 接口，而不是通用 models 接口。
