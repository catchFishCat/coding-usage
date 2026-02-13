# Coding Usage Monitor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a unified quota monitoring system for as many AI coding套餐 providers as possible, with reliable usage collection, quota evaluation, alerts, dashboard, CLI, MCP, and desktop tray support.

**Architecture:** Build a local-first core using a provider adapter framework with three ingestion modes: official API polling, local proxy interception, and local log parsing. Normalize all provider payloads into one canonical quota model in SQLite, then drive quota rules and alerts from this model. Expose the same state to Web, CLI, MCP, and optional Tauri shell.

**Tech Stack:** Node.js + TypeScript, Fastify, better-sqlite3, React + Recharts, Commander.js, @modelcontextprotocol/sdk, optional Tauri 2.x.

---

## 0) Provider Coverage Strategy (MVP + Max Coverage)

### MVP provider set (high-confidence first)
1. OpenAI (Admin usage API)
2. OpenRouter (`/api/v1/credits`)
3. DeepSeek (`/user/balance`)
4. SiliconFlow (`/v1/user/info`)
5. Anthropic Claude (OAuth usage and/or admin usage)
6. Minimax (coding plan remains endpoint)

### Max-coverage provider set (target)
7. GitHub Copilot (personal + org endpoints, scope constrained)
8. Google Gemini / Gemini CLI (project quotas + telemetry)
9. Zhipu GLM (coding endpoint + portal/plugin-assisted usage)
10. Moonshot/Kimi (balance endpoint, doc sparsity handling)
11. Local-only sources: Claude Code logs, Codex logs, OpenCode logs, Cursor cache

### Per-provider confidence tiers
- **High**: official documented endpoint + stable fields + reproducible OSS usage
- **Medium**: partially documented / scope-restricted / endpoint evolution risk
- **Low**: portal-only, scraping-dependent, or undocumented behavior

---

## 1) Canonical Contracts and Invariants

### Task 1: Define canonical model + freshness semantics

**Files:**
- Create: `docs/contracts/canonical-quota-model.md`
- Create: `docs/contracts/provider-adapter-interface.md`
- Create: `docs/contracts/window-semantics.md`

**Step 1: Write failing contract checklist**
- Add explicit required fields and unchecked acceptance checklist.

**Step 2: Define canonical structures**
- `UsageRecord`, `QuotaSnapshot`, `QuotaRule`, `ProviderHealth`, `AlertEvent`.

**Step 3: Add hard invariants**
- `window_type` must be explicit (`rolling`, `fixed`, `budget`, `balance`).
- freshness tri-state: `known`, `unknown`, `stale`.
- idempotency key required for ingestion.
- scope identity required (`personal`, `org`, `project`, `workspace`).

**Step 4: Add reference rationale per invariant**
- cc-switch: provider abstraction + migration discipline.
- LiteLLM: provider/model normalization pattern.
- Oracle risk output: stale data must not be treated as zero.

**Step 5: Commit**
```bash
git add docs/contracts
git commit -m "docs: define canonical quota contracts and invariants"
```

---

## 2) Project Skeleton and Package Boundaries

### Task 2: Scaffold monorepo with strict boundaries

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/core/package.json`
- Create: `packages/server/package.json`
- Create: `packages/cli/package.json`
- Create: `packages/mcp/package.json`
- Create: `packages/web/package.json`

**Step 1: Write failing workspace smoke tests**
- Scripts `build`, `typecheck`, `test` fail until package entrypoints exist.

**Step 2: Create minimal package entrypoints**
- Add `src/index.ts` per package.

**Step 3: Enforce dependency direction**
- `core` independent; `server/cli/mcp/web` depend on `core`.

**Step 4: Verify workspace typecheck**
Run: `pnpm install && pnpm -r typecheck`

**Step 5: Commit**
```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json packages
git commit -m "chore: scaffold monorepo boundaries for core/server/cli/mcp/web"
```

---

## 3) SQLite Schema, Migrations, and Reconciliation Tables

### Task 3: Build persistence layer (cc-switch-inspired)

**Files:**
- Create: `packages/core/src/database/schema.ts`
- Create: `packages/core/src/database/migrations.ts`
- Create: `packages/core/src/database/db.ts`
- Create: `packages/core/src/database/__tests__/migrations.test.ts`

**Step 1: Write failing migration tests**
- fresh init, upgrade path, idempotent rerun, column-add compatibility.

**Step 2: Implement tables**
- `providers`, `provider_endpoints`, `quota_rules`, `usage_records`, `quota_snapshots`, `alert_events`, `adapter_sync_state`, `provider_health`, `model_pricing`, `daily_summaries`, `reconciliation_runs`.

**Step 3: Add indexes and integrity constraints**
- provider+time, rule+time, unique idempotency keys.

**Step 4: Validate migration replay**
Run: `pnpm --filter @coding-usage/core test migrations.test.ts`

**Step 5: Commit**
```bash
git add packages/core/src/database
git commit -m "feat(core): add sqlite schema and migration pipeline"
```

Reference:
- cc-switch `src-tauri/src/database/schema.rs` (schema + migration evolution).

---

## 4) Quota Engine (rolling/fixed/budget/balance)

### Task 4: Implement quota evaluator and reset semantics

**Files:**
- Create: `packages/core/src/quota/types.ts`
- Create: `packages/core/src/quota/window.ts`
- Create: `packages/core/src/quota/engine.ts`
- Create: `packages/core/src/quota/__tests__/window.test.ts`
- Create: `packages/core/src/quota/__tests__/engine.test.ts`

**Step 1: Write failing tests**
- rolling 5h window, weekly anchor, monthly fixed reset, DST boundary.

**Step 2: Implement window evaluators**
- keep `rolling` and `fixed` paths separate; avoid implicit fallback.

**Step 3: Implement stale/unknown behavior**
- unknown must not overwrite known; stale must propagate to API/UI.

**Step 4: Implement predictive exhaustion estimate**
- simple linear forecast + confidence marker.

**Step 5: Commit**
```bash
git add packages/core/src/quota
git commit -m "feat(core): implement quota engine with strict window semantics"
```

Reference:
- Claude Quota Tracker 5h/7d display semantics.
- Oracle risk model for reset ambiguity and stale handling.

---

## 5) Provider Adapter SDK and Registry

### Task 5: Build unified adapter interfaces

**Files:**
- Create: `packages/core/src/adapters/types.ts`
- Create: `packages/core/src/adapters/base.ts`
- Create: `packages/core/src/adapters/registry.ts`
- Create: `packages/core/src/adapters/__tests__/registry.test.ts`

**Step 1: Write failing contract tests**
- required metadata: scope, window semantics, confidence, freshness TTL.

**Step 2: Implement interface families**
- `UsageApiAdapter`, `ProxyUsageExtractor`, `LogParserAdapter`.

**Step 3: Add canonical mapper**
- normalize provider payloads into `UsageRecord`.

**Step 4: Add adapter health policy**
- consecutive failure tracking, cooldown, confidence downgrade.

**Step 5: Commit**
```bash
git add packages/core/src/adapters
git commit -m "feat(core): add adapter sdk, registry, and normalization"
```

Reference:
- LiteLLM provider/model abstraction.
- cc-switch provider meta/usage script extensibility.

---

## 6) Provider Integration Matrix (per-provider atomic tasks)

### Task 6A: OpenAI adapter (high confidence)

**Files:**
- Create: `packages/core/src/adapters/providers/openai.ts`
- Create: `packages/core/src/adapters/providers/__tests__/openai.test.ts`

**Step 1: Write failing fixture tests**
- usage bucket payload mapping + pagination handling.

**Step 2: Implement adapter**
- admin-key auth, org scope tagging, rate-limit header capture.

**Step 3: Add caveat handling**
- reject standard API key for admin endpoints.

**Step 4: Commit**
```bash
git add packages/core/src/adapters/providers/openai.ts packages/core/src/adapters/providers/__tests__/openai.test.ts
git commit -m "feat(adapters): add openai usage adapter"
```

### Task 6B: OpenRouter adapter (high confidence)

**Files:**
- Create: `packages/core/src/adapters/providers/openrouter.ts`
- Create: `packages/core/src/adapters/providers/__tests__/openrouter.test.ts`

**Step 1: failing fixtures** for `/credits` response mapping.
**Step 2:** implement management-key requirement and remaining-credit derivation.
**Step 3:** add polling TTL defaults.
**Step 4:** commit.

### Task 6C: DeepSeek adapter (high confidence)

**Files:**
- Create: `packages/core/src/adapters/providers/deepseek.ts`
- Create: `packages/core/src/adapters/providers/__tests__/deepseek.test.ts`

**Step 1:** fixture tests for `balance_infos` multi-currency mapping.
**Step 2:** implement adapter and currency normalization strategy.
**Step 3:** commit.

### Task 6D: SiliconFlow adapter (high confidence)

**Files:**
- Create: `packages/core/src/adapters/providers/siliconflow.ts`
- Create: `packages/core/src/adapters/providers/__tests__/siliconflow.test.ts`

**Step 1:** fixture tests for `/v1/user/info` fields.
**Step 2:** implement adapter and status field mapping.
**Step 3:** commit.

### Task 6E: Minimax adapter (high confidence)

**Files:**
- Create: `packages/core/src/adapters/providers/minimax.ts`
- Create: `packages/core/src/adapters/providers/__tests__/minimax.test.ts`

**Step 1:** fixture tests for coding-plan remains endpoint.
**Step 2:** implement rolling 5h semantic mapping.
**Step 3:** add key-type caveat tests (coding key vs standard key).
**Step 4:** commit.

### Task 6F: Anthropic adapter (high confidence)

**Files:**
- Create: `packages/core/src/adapters/providers/anthropic.ts`
- Create: `packages/core/src/adapters/providers/__tests__/anthropic.test.ts`

**Step 1:** fixture tests for OAuth usage windows (5h/7d) and optional admin usage.
**Step 2:** implement dual-mode strategy with explicit scope labeling.
**Step 3:** commit.

### Task 6G: GitHub Copilot adapter (medium confidence)

**Files:**
- Create: `packages/core/src/adapters/providers/copilot.ts`
- Create: `packages/core/src/adapters/providers/__tests__/copilot.test.ts`

**Step 1:** fixture tests for personal `copilot_internal/user` and org metrics variants.
**Step 2:** implement required headers and auth mode matrix.
**Step 3:** add deprecation/migration guard for endpoint changes.
**Step 4:** commit.

### Task 6H: Gemini + Gemini CLI adapters (medium confidence)

**Files:**
- Create: `packages/core/src/adapters/providers/gemini.ts`
- Create: `packages/core/src/adapters/providers/gemini-cli.ts`
- Create: `packages/core/src/adapters/providers/__tests__/gemini.test.ts`

**Step 1:** fixture tests for quota-derived status mapping and telemetry-derived usage.
**Step 2:** implement project-scope quota adapter + CLI telemetry parser adapter.
**Step 3:** commit.

### Task 6I: Zhipu GLM adapter (medium/low split)

**Files:**
- Create: `packages/core/src/adapters/providers/zhipu.ts`
- Create: `packages/core/src/adapters/providers/__tests__/zhipu.test.ts`

**Step 1:** fixture tests for available coding endpoint and portal/plugin-assisted fallback.
**Step 2:** implement `high` vs `low` confidence path flags in output.
**Step 3:** commit.

### Task 6J: Moonshot/Kimi adapter (medium)

**Files:**
- Create: `packages/core/src/adapters/providers/moonshot.ts`
- Create: `packages/core/src/adapters/providers/__tests__/moonshot.test.ts`

**Step 1:** fixture tests for balance endpoint and sparse-field handling.
**Step 2:** implement adapter with strict null-safe parsing.
**Step 3:** commit.

---

## 7) Local Proxy Ingestion (cc-switch pattern)

### Task 7: Build proxy collector for usage extraction

**Files:**
- Create: `packages/server/src/proxy/server.ts`
- Create: `packages/server/src/proxy/routes.ts`
- Create: `packages/server/src/proxy/extractors/openai.ts`
- Create: `packages/server/src/proxy/extractors/anthropic.ts`
- Create: `packages/server/src/proxy/extractors/gemini.ts`
- Create: `packages/server/src/proxy/__tests__/proxy.test.ts`

**Step 1:** failing passthrough + extraction tests (streaming + non-streaming).
**Step 2:** implement localhost-only transparent proxy.
**Step 3:** persist normalized usage with source=`proxy`.
**Step 4:** commit.

Reference:
- cc-switch proxy handlers and response processing paths.

---

## 8) Local Log Ingestion (toktrack/tokscale pattern)

### Task 8: Build robust log parser collectors

**Files:**
- Create: `packages/core/src/logs/discovery.ts`
- Create: `packages/core/src/logs/parsers/claude.ts`
- Create: `packages/core/src/logs/parsers/codex.ts`
- Create: `packages/core/src/logs/parsers/gemini.ts`
- Create: `packages/core/src/logs/parsers/opencode.ts`
- Create: `packages/core/src/logs/parsers/cursor.ts`
- Create: `packages/core/src/logs/parsers/__tests__/*.test.ts`

**Step 1:** fixture tests for each source path and format.
**Step 2:** implement cold scan + warm incremental scan.
**Step 3:** implement immutable daily summaries for historical days.
**Step 4:** commit.

Reference:
- toktrack cache behavior and source paths.
- tokscale broad source discovery patterns.

---

## 9) Alert Engine and Notification Channels

### Task 9: Implement alerts with anti-fatigue controls

**Files:**
- Create: `packages/core/src/alerts/engine.ts`
- Create: `packages/core/src/alerts/channels/desktop.ts`
- Create: `packages/core/src/alerts/channels/webhook.ts`
- Create: `packages/core/src/alerts/channels/email.ts`
- Create: `packages/core/src/alerts/__tests__/engine.test.ts`

**Step 1:** failing tests for hysteresis + cooldown + dedupe.
**Step 2:** implement state machine and level transitions.
**Step 3:** implement channel delivery receipts.
**Step 4:** commit.

Reference:
- LiteLLM alerting concepts (`alerting_threshold`, report cadence).

---

## 10) Configuration Format and Migration Rules

### Task 10: Finalize config files (reference-driven)

**Files:**
- Create: `config/providers.yaml`
- Create: `config/quota-rules.yaml`
- Create: `config/notifications.yaml`
- Create: `packages/core/src/config/schema.ts`
- Create: `packages/core/src/config/load.ts`
- Create: `packages/core/src/config/migrate.ts`

**Step 1:** failing schema tests for invalid windows/units/scopes.
**Step 2:** implement layered loading (defaults -> yaml -> env -> cli).
**Step 3:** add `configVersion` and migration hooks.
**Step 4:** add `${ENV_VAR}` and keychain-ref support.
**Step 5:** commit.

Reference:
- LiteLLM YAML config shape.
- langfuse env validation discipline (adapt, not copy).

---

## 11) API, CLI, MCP, Web, Desktop Surfaces

### Task 11: Fastify API + daemon
- `packages/server/src/server.ts`
- `packages/server/src/scheduler.ts`
- `packages/server/src/routes/*.ts`

### Task 12: CLI
- `packages/cli/src/index.ts`
- `packages/cli/src/commands/*.ts`

### Task 13: MCP
- `packages/mcp/src/index.ts`
- `packages/mcp/src/tools/*.ts`

### Task 14: Web
- `packages/web/src/pages/Overview.tsx`
- `packages/web/src/pages/Trends.tsx`
- `packages/web/src/pages/Alerts.tsx`
- `packages/web/src/pages/Settings.tsx`

### Task 15: Desktop (optional but planned)
- `apps/desktop/src-tauri/src/main.rs`
- `apps/desktop/src-tauri/src/tray.rs`

For each task above, use strict TDD loop:
1. write failing test
2. verify fail
3. minimal implementation
4. verify pass
5. commit

---

## 12) Reconciliation, Quality Gates, and Rollout

### Task 16: Reconciliation worker

**Files:**
- Create: `packages/core/src/reconcile/reconcile.ts`
- Create: `packages/core/src/reconcile/__tests__/reconcile.test.ts`
- Create: `docs/verification/provider-reconciliation-matrix.md`

**Gate checks per provider before promotion**
1. Adapter fixture tests pass.
2. 7-day reconciliation drift under threshold.
3. Alert false-positive rate acceptable.
4. Security checks pass (no secret leakage).

### Task 17: Security hardening

**Files:**
- Create: `packages/core/src/security/redaction.ts`
- Create: `packages/core/src/security/key-storage.ts`
- Create: `docs/security/secrets-policy.md`
- Create: `docs/security/retention-policy.md`

### Task 18: E2E and release checklist

**Files:**
- Create: `tests/e2e/provider-matrix.e2e.ts`
- Create: `tests/e2e/alert-behavior.e2e.ts`
- Create: `docs/release/checklist.md`

Run:
```bash
pnpm -r test && pnpm -r typecheck && pnpm -r build
```

---

## 13) Per-Step Reference Requirement (mandatory)

Each task is complete only if PR notes include:
1. at least one external reference pattern used,
2. one rejected anti-pattern and reason,
3. one fixture payload source (doc/OSS),
4. one explicit caveat recorded for that provider/module.

---

## 14) Initial Execution Order (recommended)

1. Task 1-5 (contracts + core foundations)
2. Task 6A-6F (MVP adapters)
3. Task 9-11 (quota + alerts + api)
4. Task 12-14 (cli/mcp/web)
5. Task 6G-6J (max-coverage adapters)
6. Task 7-8 (proxy + logs for supplemental/real-time)
7. Task 15-18 (desktop + reconcile + release)
