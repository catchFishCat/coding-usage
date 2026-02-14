# GitHub Copilot 追踪与鉴权

## 用量追踪细节

- Official 轮询器：`packages/core/src/adapters/polling/providers/github-copilot/official.ts`
- 接口：
  - `GET https://api.github.com/copilot_internal/user`
- 必需请求头：
  - `Authorization: token <token>`
  - `User-Agent: coding-usage`
  - `Accept: application/json`

- 读取字段：
  - `copilot_plan`
  - `access_type_sku`
  - `quota_reset_date_utc`
  - `quota_snapshots.premium_interactions.entitlement`
  - `quota_snapshots.premium_interactions.remaining`
  - `quota_snapshots.premium_interactions.unlimited`

- 映射规则：
  - 若 `unlimited=true`（或 entitlement 解析后为 0）：仅记录 usage payload，不创建 quota 快照
  - 否则：
    - `limit = entitlement`
    - `used = max(0, entitlement - remaining)`
    - 规则 id：`github-copilot-premium-monthly`
    - 规则类型：fixed window
    - 单位：requests

## 鉴权来源与优先级

- token 解析顺序：
  1. `GITHUB_COPILOT_TOKEN`
  2. `GITHUB_TOKEN`
  3. 自动发现 `~/.local/share/opencode/auth.json`：
     - `github-copilot.access`
     - 回退 `github-copilot.refresh`

- 配置可见性辅助：
  - `packages/cli/src/commands/configured-providers.ts` 在检测到 opencode token 时会显示 `OPENCODE_GITHUB_COPILOT` 信号。

## 说明

- 当前实现会在 entitlement 有限时追踪月度 premium interactions。
- 计划/SKU 元数据会保留在 usage record，并在轮询结果中作为提示输出。
