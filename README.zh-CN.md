# coding-usage

[English](README.md) | 简体中文

一个本地优先的 AI 编码套餐用量监控工具，统一查看多供应商配额与使用情况。

## 你可以得到什么

- 一个 CLI，统一采集并查看各供应商套餐用量。
- 配额快照落地到本地 SQLite（`data/coding-usage.db`）。
- 支持混合配额模型（按月高级请求、滚动窗口、余额/积分）。

## 当前已实现供应商

- Codex
- Gemini
- Kimi
- GLM
- OpenRouter
- GitHub Copilot

## 快速开始

### 1）安装依赖并构建

```bash
pnpm install
pnpm -r run build
```

### 2）可选：初始化数据目录

```bash
pnpm cli init
```

### 3）配置凭据

可以直接走登录流程：

```bash
pnpm cli auth login codex
pnpm cli auth login gemini
pnpm cli auth login kimi
pnpm cli auth login github-copilot
```

也可以把 key/token 放到 `.env.local`（推荐本地使用，不入库）。

### 4）查看已配置供应商

```bash
pnpm cli configured-providers
pnpm cli configured-providers --all --json
```

### 5）一键刷新并查看实际用量

```bash
pnpm cli usage
```

`usage` 会先刷新，再输出 `Quota Status`，包含：

- 全局最近刷新时间
- 每条规则的用量（`Used: x / y`）
- 每条规则的更新时间

如果只想看缓存，不刷新：

```bash
pnpm cli usage --no-refresh
```

### 6）启动 Web 仪表盘

在两个终端分别运行 API 服务和前端：

```bash
# 终端 A
pnpm daemon

# 终端 B
pnpm dev
```

打开 `http://127.0.0.1:5173`。

开发模式下，前端通过 Vite 代理访问 `/status` 与 `/health`（代理目标 `http://127.0.0.1:8787`）。

## 常用命令

- `pnpm cli usage`：刷新并显示配额状态
- `pnpm cli status`：仅显示当前缓存配额状态
- `pnpm cli collect`：执行一次采集
- `pnpm cli collect --experimental`：包含额外探测路径
- `pnpm cli providers`：查看可用供应商
- `pnpm cli configured-providers`：查看已配置供应商
- `pnpm cli auth status`：查看 `.env.local` 中 token/key 可用性

## 说明

- 默认本地优先，数据保存在本地。
- 部分供应商路径依赖内部/非公开接口，后续可能变化。
- 如果某供应商未出现在 `Quota Status`，先执行一次 `pnpm cli usage` 并查看命令输出错误信息。

## 供应商追踪文档

- 英文索引：[docs/providers/README.md](docs/providers/README.md)
- 中文索引：[docs/providers/zh-CN/README.md](docs/providers/zh-CN/README.md)
- 每个供应商文档均包含：追踪接口路径、字段映射方式、鉴权来源优先级、回退链路。
- 英文供应商文档：
  - [Codex](docs/providers/codex-tracking-and-auth.md)
  - [Gemini](docs/providers/gemini-tracking-and-auth.md)
  - [Kimi](docs/providers/kimi-tracking-and-auth.md)
  - [GLM](docs/providers/glm-tracking-and-auth.md)
  - [OpenRouter](docs/providers/openrouter-tracking-and-auth.md)
  - [GitHub Copilot](docs/providers/github-copilot-tracking-and-auth.md)
- 中文供应商文档：
  - [Codex（中文）](docs/providers/zh-CN/codex-tracking-and-auth.zh-CN.md)
  - [Gemini（中文）](docs/providers/zh-CN/gemini-tracking-and-auth.zh-CN.md)
  - [Kimi（中文）](docs/providers/zh-CN/kimi-tracking-and-auth.zh-CN.md)
  - [GLM（中文）](docs/providers/zh-CN/glm-tracking-and-auth.zh-CN.md)
  - [OpenRouter（中文）](docs/providers/zh-CN/openrouter-tracking-and-auth.zh-CN.md)
  - [GitHub Copilot（中文）](docs/providers/zh-CN/github-copilot-tracking-and-auth.zh-CN.md)

## License

MIT
