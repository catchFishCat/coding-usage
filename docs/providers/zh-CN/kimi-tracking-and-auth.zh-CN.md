# Kimi 追踪与鉴权

## 用量追踪细节

- Official 轮询器：`packages/core/src/adapters/polling/providers/kimi/official.ts`
- 主追踪接口：
  - `GET https://api.kimi.com/coding/v1/usages`
  - 解析 `usage` 汇总与 `limits[]` 各窗口
- 数值映射规则：
  - 若 `used` 缺失但 `limit` 与 `remaining` 存在，则推导 `used = limit - remaining`
  - 周汇总规则 id：`kimi-coding-weekly`
  - 窗口规则按 duration/timeUnit 生成（例如 `kimi-coding-5h`）
  - 快照类型：fixed window，`unit=requests`，`used=<数值>`，`limit=<数值>`

- coding 接口未通过时的 Moonshot 回退：
  - `GET <MOONSHOT_BASE_URL 或 https://api.moonshot.cn>/v1/users/me/balance`
  - 写 usage record，并返回余额信息

- 控制台 session 回退：
  - `POST https://www.kimi.com/apiv2/kimi.gateway.billing.v1.BillingService/GetUsages`
  - Body：`{"scope":["FEATURE_CODING"]}`
  - 写 usage record；当前主要作为回退可见性链路

- Experimental 探测器：`packages/core/src/adapters/polling/providers/kimi/experimental.ts`
  - 若有 `KIMI_CONSOLE_SESSION_TOKEN`，先测控制台接口
  - 再测 `https://api.kimi.com/coding/v1/usages`
  - 最后回退到 `https://api.moonshot.ai/v1/users/me/balance`

## 鉴权来源与优先级

- Official 模式 token/key 优先级：
  1. `KIMI_CODE_API_KEY`
  2. `MOONSHOT_API_KEY`
  3. 自动发现 `~/.local/share/opencode/auth.json`：
     - 优先 `kimi-for-coding.key`
     - 回退 `moonshotai-cn.key`
  4. `KIMI_CONSOLE_SESSION_TOKEN`（控制台回退链路）

- 额外主机配置：
  - `MOONSHOT_BASE_URL` 可覆盖 Moonshot 余额接口默认域名（默认 `https://api.moonshot.cn`）

- CLI 登录自动发现：`packages/cli/src/commands/auth.ts`
  - 运行 `kimi login`（失败回退 `python -m kimi_cli login`）
  - 通过 Python + keyring 尝试提取 token
  - 发现后写入 `.env.local` 的 `KIMI_CONSOLE_SESSION_TOKEN`

## 说明

- 本项目优先采用 `api.kimi.com/coding/v1/usages` 作为 Kimi Coding 实际套餐用量来源。
- Moonshot 余额接口保留为兼容性回退路径。
