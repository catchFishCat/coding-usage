# GLM 追踪与鉴权

## 用量追踪细节

- Official 轮询器：`packages/core/src/adapters/polling/providers/glm/official.ts`
- 接口：
  - `GET <ZHIPU_BASE_URL 或 https://open.bigmodel.cn>/api/monitor/usage/quota/limit`
- 请求头：
  - `Authorization: <ZHIPU_AUTH_TOKEN>`（按完整值直传，不自动加 `Bearer`）
  - `Accept-Language: en-US,en`
  - `Content-Type: application/json`
- 映射逻辑：
  - 在 `limits[]` 中选取 `type` 包含 `token` 的第一项
  - 使用其 `percentage` 作为 `used`
  - 规则 id：`glm-token-window`
  - 规则名：`GLM Token Window (5h)`
  - 快照：`used=<percentage>`, `limit=100`，fixed window

- Experimental 探测器：`packages/core/src/adapters/polling/providers/glm/experimental.ts`
  - 接口：`GET https://api.z.ai/api/monitor/usage/quota/limit`
  - 请求头与 official 相同
  - 仅做可达性探测，不写 quota 快照

## 鉴权来源与优先级

- 必需：
  1. `ZHIPU_AUTH_TOKEN`

- 可选：
  - `ZHIPU_BASE_URL`（覆盖 official 默认域名）

## 说明

- GLM 在本项目中采用百分比配额表示（`limit=100`），表示窗口使用比例，而非绝对请求次数。
