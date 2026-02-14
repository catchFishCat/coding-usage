# Codex 追踪与鉴权

## 用量追踪细节

- Official 轮询器：`packages/core/src/adapters/polling/providers/codex/official.ts`
- 接口：`GET https://api.openai.com/v1/organization/usage/completions?start_time=<当前时间前24小时unix秒>`
- 必需凭据：`OPENAI_ADMIN_KEY`
- 读取字段：
  - `data[].num_model_requests`
  - `data[].input_tokens`
  - `data[].output_tokens`
- Official 当前行为：
  - 原始响应通过 `insertUsageRecord(db, "codex", "api", payload)` 入库
  - 返回总请求数/总 token 数摘要
  - Official 模式不写 quota rule 快照

- Experimental 探测器：`packages/core/src/adapters/polling/providers/codex/experimental.ts`
- 接口：`GET https://chatgpt.com/backend-api/wham/usage`
- 读取字段：
  - `plan_type`
  - `rate_limit.primary_window.used_percent`（映射 5h）
  - `rate_limit.secondary_window.used_percent`（映射 7d）
- Experimental 快照映射：
  - `codex-primary-window-5h` -> `used=<used_percent>`, `limit=100`
  - `codex-secondary-window-7d` -> `used=<used_percent>`, `limit=100`

## 鉴权来源与优先级

- Official 模式：
  1. `OPENAI_ADMIN_KEY`（必需）

- Experimental 模式：
  1. `CHATGPT_SESSION_TOKEN`（存在时优先）
  2. `OPENAI_OAUTH_ACCESS_TOKEN`（回退）
  3. 可选 `OPENAI_ACCOUNT_ID`（附加 `chatgpt-account-id` 请求头）

- CLI 自动发现路径：`packages/cli/src/commands/auth.ts`
  - 读取：
    - `~/.codex/auth.json`
    - `~/.config/codex/auth.json`
  - 将发现到的值写入本地 `.env.local`

## 说明

- Codex 私有用量接口依赖 ChatGPT Web 会话行为，存在变更风险。
- `codexOAuthFeasibility()` 已明确：私有用量接口并无稳定公开 OAuth scope 保证。
