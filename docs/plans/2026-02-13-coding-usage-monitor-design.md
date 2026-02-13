# AI 编码套餐统一用量监控工具 — 设计方案

> **日期**：2026-02-13
> **状态**：设计完成，待实施
> **项目代号**：coding-usage

---

## 1. 背景与目标

### 1.1 问题

日常开发中同时使用多个 AI 编码套餐（GitHub Copilot、OpenAI、Kimi Code、GLM、Google Gemini、DeepSeek、OpenRouter 等），每个套餐有不同的限额机制：

- **滑动窗口限额**：如 Copilot 每 5 小时 80 次 premium requests
- **固定窗口限额**：如 OpenAI 每月预算上限
- **余额消耗制**：如 OpenRouter credits、DeepSeek 余额
- **Token 计费**：如按 input/output token 单独计价

目前没有工具能统一查看这些限额的使用情况，导致：
- 不知道何时接近限额，突然无法使用
- 无法合理分配使用量到不同套餐
- 无法分析哪些工具使用效率更高

### 1.2 目标

构建一个统一的 AI 编码套餐用量监控工具，提供：

1. **统一仪表盘**：一个界面查看所有套餐的当前使用情况和剩余配额
2. **阈值告警**：配额接近限额时主动推送通知（桌面通知 + Webhook）
3. **趋势分析**：使用趋势图、耗尽时间预测、使用频率分析
4. **多入口访问**：Web 仪表盘 + CLI 命令 + MCP Server + Tauri 桌面应用

### 1.3 设计原则

- **YAGNI**：先覆盖核心 provider，其他通过插件扩展
- **本地优先**：数据存储在本地，不依赖外部服务
- **非侵入式**：不要求用户修改现有工作流
- **插件化**：每个 provider 独立适配器，易于新增

---

## 2. 现有工具调研结论

### 2.1 已有工具现状

经过全面调研，**没有任何现成工具能完整满足需求**：

| 工具 | 定位 | 覆盖能力 | 缺失能力 |
|------|------|---------|---------|
| **cc-switch** | AI CLI 代理切换工具 | 代理请求拦截、token 计数、费用统计 | 无配额规则引擎、无告警通知 |
| **toktrack** | CLI token 费用追踪 | Claude/Codex/Gemini 日志解析 | 无 API 轮询、无配额建模、无告警 |
| **Langfuse** | LLM 可观测性平台 | 50+ provider 集成、费用追踪 | 面向应用开发者非个人用户、无时间窗口配额 |
| **LiteLLM** | LLM 代理网关 | 100+ 模型、预算管控、Slack 告警 | 重量级、需 PostgreSQL、面向团队 |
| **Claude Quota Tracker** | VS Code 插件 | Claude 用量状态栏显示 | 仅支持 Claude |

### 2.2 各 Provider Usage API 可用性

| Provider | 官方 Usage API | 端点 | 可获取数据 |
|----------|---------------|------|-----------|
| **OpenAI** | ✅ 完善 | `GET /organization/usage/*` | Token 用量、请求数、速率限制，含响应头 `x-ratelimit-remaining-*` |
| **OpenRouter** | ✅ 完善 | `GET /api/v1/key` | Credits 已用/剩余、每日用量 |
| **DeepSeek** | ✅ 可用 | `GET /user/balance` | 余额（总额、赠送、充值） |
| **SiliconFlow** | ✅ 可用 | `GET /v1/user/info` | 用户余额和状态 |
| **Anthropic** | ✅ 可用 | `GET /v1/organizations/cost_report` | 时间分桶费用报告（需 Admin Key） |
| **Minimax** | ✅ 可用 | `GET /v1/api/.../coding_plan/remaining` | 剩余 prompts、5 小时动态限额 |
| **GitHub Copilot** | ⚠️ 受限 | `GET /orgs/{org}/copilot/metrics` | 需 org 管理员权限，legacy API 2026-04 下线 |
| **Google Gemini** | ⚠️ 受限 | Google Cloud Billing API | 需 Cloud 项目设置 |
| **智谱 GLM** | ⚠️ 基础 | 平台余额查询 | 仅余额信息 |
| **Moonshot/Kimi** | ⚠️ 基础 | 平台余额查询 | 余额和速率信息 |

### 2.3 架构参考

核心借鉴 **cc-switch** 的以下设计模式：
- HTTP 代理拦截请求 → 从响应提取 token 用量
- Provider 抽象层（UniversalProvider → app-specific 转换）
- JavaScript 自定义查询脚本（可扩展的 Usage API 调用）
- SQLite 请求日志表 + 模型定价表
- 基于 provider cost multiplier 的费用计算

同时参考 **toktrack** 的：
- 日志文件解析（Cold/Warm 路径优化）
- 不可变每日摘要缓存

---

## 3. 系统架构

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│  ⑤ 展示层                                                    │
│     Web Dashboard / CLI / MCP Server / Tauri 桌面应用         │
├─────────────────────────────────────────────────────────────┤
│  ④ 告警引擎                                                  │
│     规则评估 / 耗尽预测 / 多通道通知（桌面/Webhook/邮件）       │
├─────────────────────────────────────────────────────────────┤
│  ③ 配额规则引擎                                              │
│     时间窗口配额(5h/周/月) / Token 配额 / 费用预算             │
├─────────────────────────────────────────────────────────────┤
│  ② 数据归一化层                                              │
│     Provider Adapter → 统一 UsageRecord/QuotaSnapshot 模型   │
├─────────────────────────────────────────────────────────────┤
│  ① 数据采集层                                                │
│     API Poller(定时拉取) / Proxy(拦截计数) / Log Parser       │
└─────────────────────────────────────────────────────────────┘
         │
    ┌────▼────┐
    │ SQLite  │  本地持久化
    └─────────┘
```

### 3.2 部署架构

```
┌─────────────────────────────────────────────┐
│         Tauri Shell（桌面容器）              │
│  ┌────────────────────────────────────────┐ │
│  │  React Web Dashboard (WebView)        │ │
│  └──────────────────┬─────────────────────┘ │
│                     │ IPC                    │
│  ┌──────────────────▼─────────────────────┐ │
│  │  Rust Layer                            │ │
│  │  - 系统托盘（图标颜色反映整体状态）      │ │
│  │  - 原生通知推送                         │ │
│  │  - 开机自启管理                         │ │
│  │  - Sidecar 管理（启动 Node.js 后端）    │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         │ HTTP localhost:PORT
┌────────▼────────────────────────────────────┐
│  Node.js Backend (独立进程 / Sidecar)       │
│  ┌────────────────────────────────────────┐ │
│  │ Fastify HTTP Server                    │ │
│  │  ├── REST API  (/api/status, /api/...) │ │
│  │  ├── Static    (Web Dashboard 静态文件)  │ │
│  │  └── Proxy     (AI 请求代理拦截)        │ │
│  ├────────────────────────────────────────┤ │
│  │ 核心服务                                │ │
│  │  ├── DataCollectorService  (数据采集)   │ │
│  │  ├── QuotaEngineService    (配额规则)   │ │
│  │  ├── AlertService          (告警通知)   │ │
│  │  └── AnalyticsService      (趋势分析)   │ │
│  ├────────────────────────────────────────┤ │
│  │ MCP Server (stdio 或 SSE 模式)         │ │
│  ├────────────────────────────────────────┤ │
│  │ SQLite Database                        │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

桌面应用和 CLI/Web/MCP 共享同一个 Node.js 后端。无桌面应用时也能独立运行（`coding-usage daemon start`）。

---

## 4. 详细设计

### 4.1 数据采集层（① 层）

三种采集策略并行，每个 Provider 根据其 API 能力选择最适合的方式：

#### 策略 A：API Poller（定时拉取 Usage API）

适用于有官方用量/余额 API 的服务。

```typescript
interface UsageApiAdapter {
  id: string;                    // "openai", "openrouter", "deepseek" ...
  name: string;                  // 显示名称
  fetchUsage(config: ProviderConfig): Promise<UsageSnapshot>;
  pollInterval: number;          // 轮询间隔（毫秒），默认 300_000 (5分钟)
}

interface UsageSnapshot {
  timestamp: number;
  provider: string;
  metrics: {
    requestCount?: number;       // 已用请求次数
    tokenCount?: number;         // 已用 token 数
    balance?: number;            // 剩余余额（元/美元）
    creditsUsed?: number;        // 已用积分
    creditsRemaining?: number;   // 剩余积分
    quotaUsed?: number;          // 通用配额已用量
    quotaLimit?: number;         // 通用配额总量
    resetAt?: number;            // 下次重置时间戳
  };
  raw: any;                      // 原始 API 响应（调试用）
}
```

**各 Provider 实现映射**：

| Provider | 端点 | 认证方式 | 获取数据 |
|----------|------|---------|---------|
| OpenAI | `GET /organization/usage/completions` | Admin Key (Bearer) | input/output tokens, request count |
| OpenAI Rate Limits | `GET /organization/projects/{id}/rate_limits` | Admin Key | per-model rate limits |
| OpenRouter | `GET /api/v1/key` | API Key (Bearer) | usage, limit, limit_remaining |
| DeepSeek | `GET /user/balance` | API Key (Bearer) | balance_infos (total, granted, topped_up) |
| SiliconFlow | `GET /v1/user/info` | API Key (Bearer) | user balance, status |
| Anthropic | `GET /v1/organizations/cost_report` | Admin Key | cost per time bucket |
| Minimax | `GET /v1/api/.../coding_plan/remaining` | Coding Plan Key | remaining prompts |
| GitHub Copilot | `GET /orgs/{org}/copilot/metrics` | PAT (manage_billing) | active users, suggestions |
| 智谱 GLM | 平台 API | API Key | balance |
| Moonshot/Kimi | 平台 API | API Key | balance, rate info |

#### 策略 B：Local Proxy（本地代理拦截）

借鉴 cc-switch 的 HTTP 代理设计。启动本地代理服务器，拦截 AI 编码工具的请求，从响应中提取 token 用量。

```typescript
interface ProxyConfig {
  enabled: boolean;
  port: number;                  // 默认 8377
  routes: ProxyRoute[];
}

interface ProxyRoute {
  pattern: string;               // URL 匹配，如 "api.openai.com"
  provider: string;              // 目标 provider ID
  apiFormat: "openai" | "anthropic" | "gemini" | "custom";
}

// 从响应中提取用量（参考 cc-switch 的 response_processor）
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  model: string;
}
```

**代理模式工作流**：

1. AI 编码工具 → 发送请求到 `localhost:8377`
2. 代理匹配路由 → 转发到实际 provider
3. 接收响应 → 提取 usage（streaming: SSE 最后一条; non-streaming: JSON body）
4. 记录 UsageRecord → 返回原始响应给客户端

**配置方式**：用户需将 AI 编码工具的 API base URL 指向本地代理。

#### 策略 C：Log Parser（CLI 日志解析）

解析 AI CLI 工具产生的本地日志文件。

```typescript
interface LogParserAdapter {
  id: string;
  name: string;
  logPaths: string[];            // 日志文件路径（支持 glob 和平台变量）
  parseLog(content: string): UsageRecord[];
  watchMode: boolean;            // 是否用 fs.watch 实时监控
}
```

**已知 CLI 日志路径**：

| CLI 工具 | 日志路径 | 数据格式 |
|----------|---------|---------|
| Claude Code | `~/.claude/projects/*/conversations/*.json` | JSON (token usage in metadata) |
| Gemini CLI | `~/.gemini/` 相关目录 | JSON |
| Codex CLI | 本地数据目录 | JSON |

#### Provider 到策略的推荐映射

| Provider | 策略 A (API) | 策略 B (Proxy) | 策略 C (Log) | 推荐组合 |
|----------|-------------|---------------|-------------|---------|
| OpenAI | ✅ | ✅ | - | A + B |
| OpenRouter | ✅ | ✅ | - | A |
| DeepSeek | ✅ | ✅ | - | A + B |
| SiliconFlow | ✅ | ✅ | - | A |
| Anthropic/Claude | ✅ | ✅ | ✅ | A + C |
| Minimax | ✅ | - | - | A |
| GitHub Copilot | ✅(受限) | - | - | A |
| Google Gemini | ⚠️ | ✅ | ✅ | B + C |
| 智谱 GLM | ⚠️ | ✅ | - | A + B |
| Moonshot/Kimi | ⚠️ | ✅ | - | A + B |

---

### 4.2 数据归一化层（② 层）

所有采集策略的数据归一到统一模型：

```typescript
// 统一用量记录
interface UsageRecord {
  id: string;                    // UUID
  provider: string;              // provider ID
  timestamp: number;             // Unix 毫秒时间戳
  source: "api" | "proxy" | "log";

  // 用量指标（各 provider 按能力填充，不支持的为 null）
  requestCount: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  model: string | null;
  sessionId: string | null;      // 关联的编码会话
}

// 配额快照（定时由配额引擎计算并写入）
interface QuotaSnapshot {
  provider: string;
  quotaRuleId: string;
  timestamp: number;
  used: number;                  // 当前窗口已用量
  limit: number;                 // 限额
  percentage: number;            // 使用百分比 (0-1)
  resetsAt: number | null;       // 下次重置时间
  predictedExhaustAt: number | null; // 预测耗尽时间
}
```

### 4.3 SQLite 数据库 Schema

```sql
-- Provider 配置
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'custom',  -- official, aggregator, third_party, custom
  enabled BOOLEAN DEFAULT 1,
  config TEXT NOT NULL DEFAULT '{}',  -- JSON: API keys, endpoints, etc.
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 配额规则
CREATE TABLE quota_rules (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL REFERENCES providers(id),
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  type TEXT NOT NULL,              -- sliding_window, fixed_window, budget, balance
  "limit" REAL NOT NULL,
  unit TEXT NOT NULL,              -- requests, tokens, usd, credits, prompts
  window_size INTEGER,             -- 窗口大小（数值部分）
  window_unit TEXT,                -- minutes, hours, days, weeks, months
  reset_anchor TEXT,               -- 固定窗口重置锚点，如 "monday 00:00"
  alert_thresholds TEXT NOT NULL DEFAULT '[0.7, 0.85, 0.95]',  -- JSON 数组
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 用量记录
CREATE TABLE usage_records (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL REFERENCES providers(id),
  timestamp INTEGER NOT NULL,
  source TEXT NOT NULL,             -- api, proxy, log
  request_count INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd REAL,
  model TEXT,
  session_id TEXT,
  raw_data TEXT                     -- JSON: 原始数据（调试用）
);
CREATE INDEX idx_usage_provider_ts ON usage_records(provider, timestamp);

-- 配额快照
CREATE TABLE quota_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  quota_rule_id TEXT NOT NULL REFERENCES quota_rules(id),
  timestamp INTEGER NOT NULL,
  used REAL NOT NULL,
  "limit" REAL NOT NULL,
  percentage REAL NOT NULL,
  resets_at INTEGER,
  predicted_exhaust_at INTEGER
);
CREATE INDEX idx_snapshot_rule_ts ON quota_snapshots(quota_rule_id, timestamp);

-- 告警事件
CREATE TABLE alert_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  quota_rule_id TEXT NOT NULL,
  level TEXT NOT NULL,              -- info, warning, critical
  percentage REAL NOT NULL,
  message TEXT NOT NULL,
  predicted_exhaust_at INTEGER,
  timestamp INTEGER NOT NULL,
  acknowledged BOOLEAN DEFAULT 0,
  notified_channels TEXT DEFAULT '[]'  -- JSON: 已通知的通道
);
CREATE INDEX idx_alert_ts ON alert_events(timestamp);

-- 模型定价（借鉴 cc-switch）
CREATE TABLE model_pricing (
  model_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  input_cost_per_million REAL NOT NULL DEFAULT 0,
  output_cost_per_million REAL NOT NULL DEFAULT 0,
  cache_read_cost_per_million REAL DEFAULT 0,
  cache_creation_cost_per_million REAL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- 每日摘要（借鉴 toktrack 不可变缓存思路）
CREATE TABLE daily_summaries (
  date TEXT NOT NULL,               -- YYYY-MM-DD
  provider TEXT NOT NULL,
  total_requests INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  models_used TEXT DEFAULT '[]',    -- JSON: 使用过的模型列表
  PRIMARY KEY (date, provider)
);
```

---

### 4.4 配额规则引擎（③ 层）

#### 配额规则定义

```typescript
interface QuotaRule {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;

  // 限额类型
  type: "sliding_window" | "fixed_window" | "budget" | "balance";

  // 限额参数
  limit: number;
  unit: "requests" | "tokens" | "usd" | "credits" | "prompts";

  // 时间窗口（sliding_window 和 fixed_window 类型）
  window?: {
    size: number;
    sizeUnit: "minutes" | "hours" | "days" | "weeks" | "months";
    resetAnchor?: string;        // 固定窗口的重置锚点
  };

  // 告警阈值（0-1 之间的百分比）
  alertThresholds: number[];
}
```

#### 预置配额规则示例

```yaml
# GitHub Copilot — 滑动窗口限额
- provider: copilot
  name: "Copilot 5小时 Premium 限额"
  type: sliding_window
  limit: 80
  unit: requests
  window: { size: 5, sizeUnit: hours }
  alertThresholds: [0.7, 0.9]

# OpenAI — 月度预算
- provider: openai
  name: "OpenAI 月度预算"
  type: budget
  limit: 50
  unit: usd
  window: { size: 1, sizeUnit: months, resetAnchor: "1st 00:00" }
  alertThresholds: [0.8, 0.95]

# OpenRouter — 余额监控
- provider: openrouter
  name: "OpenRouter 余额"
  type: balance
  limit: 100
  unit: credits
  alertThresholds: [0.3, 0.15, 0.05]

# DeepSeek — 余额监控
- provider: deepseek
  name: "DeepSeek 余额"
  type: balance
  limit: 50
  unit: usd
  alertThresholds: [0.3, 0.15]

# Minimax — 编码套餐（5小时动态限额）
- provider: minimax
  name: "Minimax 5小时编码限额"
  type: sliding_window
  limit: 200
  unit: prompts
  window: { size: 5, sizeUnit: hours }
  alertThresholds: [0.7, 0.9]

# Kimi Code — 月度用量
- provider: kimi
  name: "Kimi 月度预算"
  type: budget
  limit: 30
  unit: usd
  window: { size: 1, sizeUnit: months }
  alertThresholds: [0.8, 0.95]
```

#### 评估循环

```typescript
class QuotaEngine {
  // 每分钟执行一次（可配置）
  async evaluate(): Promise<AlertEvent[]> {
    const rules = await this.db.getEnabledQuotaRules();
    const alerts: AlertEvent[] = [];

    for (const rule of rules) {
      // 1. 计算当前窗口的使用量
      const used = await this.calculateCurrentUsage(rule);

      // 2. 计算使用百分比
      const percentage = used / rule.limit;

      // 3. 预测耗尽时间
      const predictedExhaustAt = await this.predictExhaustion(rule, used);

      // 4. 写入快照
      await this.db.insertQuotaSnapshot({
        provider: rule.provider,
        quotaRuleId: rule.id,
        timestamp: Date.now(),
        used,
        limit: rule.limit,
        percentage,
        resetsAt: this.calculateResetTime(rule),
        predictedExhaustAt,
      });

      // 5. 检查是否触发告警
      for (const threshold of rule.alertThresholds) {
        if (percentage >= threshold) {
          const existing = await this.db.findRecentAlert(rule.id, threshold);
          if (!existing) {
            alerts.push(this.createAlert(rule, percentage, predictedExhaustAt));
          }
        }
      }
    }

    return alerts;
  }

  private async calculateCurrentUsage(rule: QuotaRule): Promise<number> {
    switch (rule.type) {
      case "sliding_window": {
        const windowMs = this.windowToMs(rule.window!);
        const since = Date.now() - windowMs;
        return this.db.sumUsage(rule.provider, rule.unit, since);
      }
      case "fixed_window": {
        const windowStart = this.getFixedWindowStart(rule.window!);
        return this.db.sumUsage(rule.provider, rule.unit, windowStart);
      }
      case "budget": {
        const windowStart = this.getFixedWindowStart(rule.window!);
        return this.db.sumCost(rule.provider, windowStart);
      }
      case "balance": {
        // 从最新 UsageSnapshot 获取剩余余额
        const snapshot = await this.db.getLatestSnapshot(rule.provider);
        return rule.limit - (snapshot?.metrics.creditsRemaining ?? 0);
      }
    }
  }

  private async predictExhaustion(rule: QuotaRule, currentUsed: number): Promise<number | null> {
    // 基于最近 2 小时的使用速率，线性预测
    const recentRecords = await this.db.getRecentRecords(rule.provider, 2 * 3600_000);
    const rate = this.calculateRate(recentRecords, rule.unit);
    if (rate <= 0) return null;

    const remaining = rule.limit - currentUsed;
    const msUntilExhaust = (remaining / rate) * 3600_000;
    return Date.now() + msUntilExhaust;
  }
}
```

---

### 4.5 告警引擎（④ 层）

#### 告警事件模型

```typescript
interface AlertEvent {
  id: string;
  provider: string;
  quotaRuleId: string;
  level: "info" | "warning" | "critical";
  percentage: number;
  message: string;
  predictedExhaustAt: number | null;
  timestamp: number;
  acknowledged: boolean;
  notifiedChannels: string[];
}
```

**告警级别映射**：

| 使用百分比 | 级别 | 描述 |
|-----------|------|------|
| >= 70% | info | 已用较多，注意控制 |
| >= 85% | warning | 接近限额，建议切换 |
| >= 95% | critical | 即将耗尽，紧急 |

#### 告警去重机制

同一 QuotaRule 的同一阈值等级，在一个窗口周期内只告警一次。窗口重置后计数清零。跨越更高阈值时触发新告警。

#### 通知通道（插件式）

```typescript
interface NotificationChannel {
  id: string;
  name: string;
  enabled: boolean;
  send(alert: AlertEvent): Promise<void>;
}

// 实现列表
class DesktopNotification implements NotificationChannel { ... }
  // 使用 node-notifier 或 Tauri 原生通知
  // 图标颜色根据 level 变化

class WebhookNotification implements NotificationChannel { ... }
  // HTTP POST 到配置的 URL
  // 支持飞书/钉钉/Slack 的消息格式模板

class EmailNotification implements NotificationChannel { ... }
  // SMTP 或 Resend API
  // 支持每日汇总邮件

class TerminalNotification implements NotificationChannel { ... }
  // CLI 运行时的标准输出告警

class McpNotification implements NotificationChannel { ... }
  // 通过 MCP resource 暴露告警数据
```

#### Webhook 消息格式（飞书示例）

```json
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": { "content": "⚠️ AI 编码配额告警", "tag": "plain_text" },
      "template": "orange"
    },
    "elements": [{
      "tag": "div",
      "text": {
        "content": "**OpenAI** 月度预算已用 **85%**\n已消耗 $42.50 / $50.00\n预计 3 天后耗尽",
        "tag": "lark_md"
      }
    }]
  }
}
```

---

### 4.6 展示层（⑤ 层）

#### 入口 1：Web Dashboard

React SPA，由 Node.js 后端 serve 静态文件。

**4 个核心视图**：

**A. Overview（概览）**
- 卡片网格展示所有 provider 的当前状态
- 每张卡片：provider 名称 + 进度条 + 百分比 + 重置倒计时
- 颜色编码：绿色 (<70%) → 黄色 (70-85%) → 橙色 (85-95%) → 红色 (>95%)

**B. Trends（趋势）**
- 折线图：每日/每周/每月用量趋势
- 按 provider 分组 / 按总量聚合
- 支持日期范围选择
- 叠加配额限制线

**C. Alerts（告警）**
- 时间线展示所有告警事件
- 按级别筛选（info / warning / critical）
- 支持手动确认告警

**D. Settings（设置）**
- Provider 管理（增删改、API Key 配置）
- 配额规则管理
- 通知通道配置
- 代理服务器配置
- 全局设置（轮询间隔、数据保留天数等）

**技术选型**：React 18 + Vite + Tailwind CSS + shadcn/ui + Recharts

#### 入口 2：CLI 命令

```bash
# 快速查看所有配额状态
$ coding-usage status
┌──────────────┬──────────┬────────┬─────────┬──────────────┐
│ Provider     │ Used     │ Limit  │ Percent │ Resets       │
├──────────────┼──────────┼────────┼─────────┼──────────────┤
│ Copilot      │ 34 req   │ 80     │ 42%     │ 2h 15m       │
│ OpenAI       │ $39.20   │ $50    │ 78% ⚠️  │ 18 days      │
│ OpenRouter   │ 45 cr    │ 100 cr │ 45%     │ -            │
│ DeepSeek     │ ¥12.50   │ ¥50    │ 25%     │ -            │
│ Kimi         │ ¥8.00    │ ¥30    │ 27%     │ 22 days      │
└──────────────┴──────────┴────────┴─────────┴──────────────┘

# 查看某个 provider 的使用趋势
$ coding-usage trend openai --days 7

# 查看活跃告警
$ coding-usage alerts

# 启动后台守护进程
$ coding-usage daemon start

# 停止守护进程
$ coding-usage daemon stop

# 打开 Web 仪表盘
$ coding-usage dashboard

# 添加 provider
$ coding-usage provider add openai --api-key sk-xxx

# 初始化配置
$ coding-usage init
```

**技术选型**：Commander.js（命令解析）+ Ink（丰富终端输出）

#### 入口 3：MCP Server

```typescript
const server = new McpServer({ name: "coding-usage", version: "1.0.0" });

// Tools
server.tool("get_quota_status", "查看所有 AI 编码套餐的配额使用状态", {}, async () => {
  const statuses = await quotaEngine.getAllStatus();
  return { content: [{ type: "text", text: formatStatusTable(statuses) }] };
});

server.tool("get_usage_trend", "查看指定 provider 的使用趋势", {
  provider: z.string().describe("Provider ID"),
  days: z.number().default(7).describe("天数"),
}, async ({ provider, days }) => {
  const trend = await analytics.getTrend(provider, days);
  return { content: [{ type: "text", text: formatTrend(trend) }] };
});

server.tool("check_alerts", "查看当前活跃告警", {}, async () => {
  const alerts = await alertService.getActiveAlerts();
  return { content: [{ type: "text", text: formatAlerts(alerts) }] };
});

// Resources
server.resource("quota://dashboard", "配额状态概览", async () => {
  const html = await renderDashboardSummary();
  return { contents: [{ uri: "quota://dashboard", mimeType: "text/html", text: html }] };
});
```

**运行模式**：stdio（本地 AI 工具集成）或 SSE（远程访问）

#### 入口 4：Tauri 桌面应用

```
┌─ 系统托盘 ────────────────────────────────┐
│                                            │
│  图标颜色: 🟢 正常 / 🟡 警告 / 🔴 危急     │
│                                            │
│  右键菜单:                                  │
│  ├── 📊 打开仪表盘 → 弹出主窗口 (WebView)   │
│  ├── 📋 快速状态 → 悬浮小窗                  │
│  │   ┌────────────────────────────┐        │
│  │   │ Copilot   ██░░░  42%      │        │
│  │   │ OpenAI    ████░  78% ⚠️   │        │
│  │   │ Kimi      █░░░░  15%      │        │
│  │   └────────────────────────────┘        │
│  ├── 🔔 告警 (2 条未读)                    │
│  ├── ⚙️ 设置                               │
│  └── 退出                                  │
│                                            │
│  原生通知弹窗:                               │
│  ┌────────────────────────────────────┐    │
│  │ ⚠️ OpenAI 月度预算已用 78%          │    │
│  │ 已消耗 $39.20 / $50.00             │    │
│  │ 预计 3 天后耗尽，建议控制用量         │    │
│  └────────────────────────────────────┘    │
└────────────────────────────────────────────┘
```

**主窗口**：嵌入 Web Dashboard（与浏览器访问相同的 React 应用）

**Rust 层职责（最小化）**：
- 系统托盘图标管理 + 右键菜单
- 原生通知推送
- 开机自启注册
- Sidecar 进程管理（启动/停止 Node.js 后端）

---

## 5. 技术选型汇总

| 模块 | 技术 | 版本 | 选择理由 |
|------|-----|------|---------|
| **后端运行时** | Node.js + TypeScript | 20 LTS | 前后端统一语言，npm 生态丰富 |
| **包管理** | pnpm | 9.x | monorepo 支持好，磁盘效率高 |
| **数据库** | better-sqlite3 | 11.x | 嵌入式零配置，同步 API 简单 |
| **Web 框架** | Fastify | 5.x | 轻量高性能，插件化架构 |
| **HTTP 代理** | http-proxy-middleware | 3.x | 成熟的 Node.js 代理中间件 |
| **定时任务** | node-cron | 3.x | 轻量级 cron 表达式支持 |
| **CLI 框架** | Commander.js | 12.x | 事实标准，类型安全 |
| **CLI 输出** | cli-table3 + chalk | - | 终端表格和颜色输出 |
| **MCP SDK** | @modelcontextprotocol/sdk | latest | 官方 MCP 协议实现 |
| **前端框架** | React 18 + Vite | 5.x | 构建快、与 Tauri 兼容 |
| **UI 组件库** | shadcn/ui + Radix UI | - | 现代 UI，与 cc-switch 一致 |
| **CSS** | Tailwind CSS | 3.x | 实用优先，快速开发 |
| **图表** | Recharts | 2.x | React 原生图表库 |
| **桌面应用** | Tauri | 2.x | 轻量跨平台，与 cc-switch 同栈 |
| **系统通知** | node-notifier + Tauri 原生 | - | 跨平台桌面通知 |
| **Schema 校验** | Zod | 3.x | TypeScript 优先的 Schema 校验 |
| **HTTP Client** | undici / ofetch | - | Node.js 原生 HTTP 客户端 |

---

## 6. 项目结构

```
coding-usage/
├── packages/
│   ├── core/                    # 核心业务逻辑
│   │   ├── src/
│   │   │   ├── adapters/        # Provider 适配器
│   │   │   │   ├── openai.ts
│   │   │   │   ├── openrouter.ts
│   │   │   │   ├── deepseek.ts
│   │   │   │   ├── copilot.ts
│   │   │   │   ├── anthropic.ts
│   │   │   │   ├── minimax.ts
│   │   │   │   ├── siliconflow.ts
│   │   │   │   ├── zhipu.ts
│   │   │   │   ├── moonshot.ts
│   │   │   │   └── gemini.ts
│   │   │   ├── services/
│   │   │   │   ├── collector.ts     # 数据采集调度
│   │   │   │   ├── quota-engine.ts  # 配额规则引擎
│   │   │   │   ├── alert.ts         # 告警服务
│   │   │   │   ├── analytics.ts     # 趋势分析
│   │   │   │   └── proxy.ts         # 代理服务器
│   │   │   ├── notifications/
│   │   │   │   ├── desktop.ts       # 桌面通知
│   │   │   │   ├── webhook.ts       # Webhook (飞书/钉钉/Slack)
│   │   │   │   ├── email.ts         # 邮件通知
│   │   │   │   └── terminal.ts      # 终端通知
│   │   │   ├── database/
│   │   │   │   ├── schema.ts        # 建表语句
│   │   │   │   ├── migrations.ts    # 数据库迁移
│   │   │   │   └── db.ts            # 数据库操作封装
│   │   │   ├── models/              # 类型定义
│   │   │   │   ├── provider.ts
│   │   │   │   ├── quota-rule.ts
│   │   │   │   ├── usage-record.ts
│   │   │   │   └── alert-event.ts
│   │   │   └── config/
│   │   │       └── defaults.ts      # 默认配置和预置规则
│   │   └── package.json
│   │
│   ├── server/                  # HTTP 服务（Fastify）
│   │   ├── src/
│   │   │   ├── routes/          # REST API 路由
│   │   │   ├── server.ts        # Fastify 服务器
│   │   │   └── daemon.ts        # 守护进程管理
│   │   └── package.json
│   │
│   ├── cli/                     # CLI 命令行工具
│   │   ├── src/
│   │   │   ├── commands/        # 子命令
│   │   │   └── index.ts         # 入口
│   │   └── package.json
│   │
│   ├── mcp/                     # MCP Server
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── web/                     # Web Dashboard (React)
│       ├── src/
│       │   ├── components/      # UI 组件
│       │   ├── pages/           # 页面
│       │   ├── hooks/           # React hooks
│       │   └── App.tsx
│       └── package.json
│
├── apps/
│   └── desktop/                 # Tauri 桌面应用
│       ├── src-tauri/           # Rust 后端
│       │   ├── src/
│       │   │   ├── main.rs
│       │   │   └── tray.rs      # 系统托盘
│       │   └── Cargo.toml
│       └── package.json
│
├── config/                      # 用户配置目录（运行时）
│   ├── providers.yaml           # Provider 配置
│   ├── quota-rules.yaml         # 配额规则
│   └── notifications.yaml       # 通知配置
│
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

---

## 7. 实施路线图

### Phase 1：核心功能（2 周）
- [ ] 项目骨架搭建（monorepo, TypeScript 配置）
- [ ] SQLite 数据库 + Schema
- [ ] Provider 适配器：OpenAI, OpenRouter, DeepSeek（API Poller）
- [ ] 配额规则引擎（sliding_window, budget, balance）
- [ ] CLI `status` 命令
- [ ] CLI `daemon` 守护进程

### Phase 2：告警与通知（1 周）
- [ ] 告警引擎 + 去重机制
- [ ] 桌面通知（node-notifier）
- [ ] Webhook 通知（飞书/Slack 格式）
- [ ] CLI `alerts` 命令

### Phase 3：Web Dashboard（2 周）
- [ ] React 应用骨架
- [ ] Overview 页面（配额卡片）
- [ ] Trends 页面（趋势图表）
- [ ] Alerts 页面
- [ ] Settings 页面
- [ ] Fastify 静态文件 serve

### Phase 4：扩展 Provider（1 周）
- [ ] GitHub Copilot 适配器
- [ ] Anthropic/Claude 适配器
- [ ] Minimax 适配器
- [ ] SiliconFlow 适配器
- [ ] 智谱 GLM / Moonshot 适配器
- [ ] Google Gemini 适配器

### Phase 5：高级功能（2 周）
- [ ] Local Proxy 代理拦截模式
- [ ] Log Parser（Claude Code / Gemini CLI 日志解析）
- [ ] MCP Server
- [ ] 耗尽时间预测算法优化
- [ ] 邮件通知 + 每日摘要

### Phase 6：桌面应用（2 周）
- [ ] Tauri 项目搭建
- [ ] 系统托盘 + 状态图标
- [ ] 原生通知集成
- [ ] 开机自启
- [ ] Sidecar 模式运行 Node.js 后端
- [ ] 打包分发（Windows / macOS / Linux）

---

## 8. 配置文件示例

### providers.yaml

```yaml
providers:
  - id: openai
    name: "OpenAI"
    category: official
    enabled: true
    config:
      adminKey: "sk-admin-xxx"      # Organization admin key
      orgId: "org-xxx"

  - id: openrouter
    name: "OpenRouter"
    category: aggregator
    enabled: true
    config:
      apiKey: "sk-or-xxx"

  - id: deepseek
    name: "DeepSeek"
    category: official
    enabled: true
    config:
      apiKey: "sk-xxx"

  - id: copilot
    name: "GitHub Copilot"
    category: official
    enabled: true
    config:
      pat: "ghp_xxx"               # Personal Access Token
      org: "my-org"

  - id: kimi
    name: "Kimi Code"
    category: official
    enabled: true
    config:
      apiKey: "sk-xxx"

  - id: minimax
    name: "Minimax"
    category: official
    enabled: true
    config:
      codingPlanKey: "xxx"

  - id: siliconflow
    name: "SiliconFlow"
    category: aggregator
    enabled: true
    config:
      apiKey: "sk-xxx"

  - id: zhipu
    name: "智谱 GLM"
    category: official
    enabled: true
    config:
      apiKey: "xxx"

  - id: gemini
    name: "Google Gemini"
    category: official
    enabled: true
    config:
      apiKey: "xxx"
      projectId: "my-project"
```

### notifications.yaml

```yaml
channels:
  - id: desktop
    type: desktop
    enabled: true

  - id: feishu
    type: webhook
    enabled: true
    config:
      url: "https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
      template: feishu

  - id: email-daily
    type: email
    enabled: false
    config:
      smtp:
        host: "smtp.gmail.com"
        port: 587
        user: "xxx@gmail.com"
        pass: "app-password"
      to: "xxx@gmail.com"
      schedule: "0 20 * * *"       # 每天 20:00 发送日报
```

---

## 9. 安全考虑

1. **API Key 存储**：配置文件建议使用环境变量引用（`$ENV_VAR`）或系统 keychain
2. **代理模式**：仅监听 localhost，不对外暴露
3. **Web Dashboard**：本地访问无需认证；远程访问需配置 Basic Auth 或 Token
4. **数据保留**：默认保留 90 天详细记录，365 天每日摘要
5. **敏感数据**：请求/响应内容不记录，仅统计 token 数和费用

---

## 10. 已知风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Provider API 变更 | 适配器失效 | 插件化设计，单个适配器失效不影响整体 |
| 部分 provider 无官方 Usage API | 数据不完整 | 多策略并行（API + Proxy + Log） |
| GitHub Copilot legacy API 2026-04 下线 | 需迁移 | 提前适配新版 Copilot metrics API |
| 代理模式需用户手动配置工具 | 使用门槛 | 提供一键配置脚本 + 详细文档 |
| 滑动窗口计算性能 | 大量历史数据时变慢 | 每日摘要缓存 + 索引优化 |
