# OpenRouter 追踪与鉴权

## 用量追踪细节

- Official 轮询器：`packages/core/src/adapters/polling/providers/openrouter/official.ts`
- 接口：
  - `GET https://openrouter.ai/api/v1/key`
- 必需凭据：
  - `OPENROUTER_API_KEY`
- 读取字段：
  - `data.usage`
  - `data.limit`
- 映射：
  - 规则 id：`openrouter-credits-balance`
  - 规则类型：`balance`
  - 单位：`credits`
  - 快照：`used=<usage>`, `limit=<limit>`
  - 原始 payload 通过 `insertUsageRecord` 入库

## 鉴权来源与优先级

- 必需：
  1. `OPENROUTER_API_KEY`

- 当前代码未实现 OpenRouter 的本地 auth 文件自动发现路径。

## 说明

- OpenRouter 在本项目中按积分/余额模型追踪，不是请求窗口模型。
