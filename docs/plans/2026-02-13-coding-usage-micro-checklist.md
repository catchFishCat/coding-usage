# Coding Usage Micro Checklist (Verifiable)

> Goal: execute the implementation plan in extremely small, testable steps.
> Rule: each step is done only when its verification command/output matches expectation.

## A. Repository and Workspace Bootstrap

1. [ ] Confirm working directory is project root.
   - Verify: `pwd` shows repository root.
2. [ ] Confirm plan files exist.
   - Verify: `ls docs/plans` includes design + implementation plan.
3. [ ] Create monorepo root `package.json`.
   - Verify: file exists and parses as valid JSON.
4. [ ] Add root script `typecheck`.
   - Verify: `pnpm run typecheck` runs (may fail before package setup, but command resolves).
5. [ ] Add root script `test`.
   - Verify: `pnpm run test` resolves script.
6. [ ] Add root script `build`.
   - Verify: `pnpm run build` resolves script.
7. [ ] Create `pnpm-workspace.yaml`.
   - Verify: workspace packages are discoverable with `pnpm -r list`.
8. [ ] Create `tsconfig.base.json`.
   - Verify: `tsc -p tsconfig.base.json --noEmit` runs.
9. [ ] Create `packages/core` folder and `package.json`.
   - Verify: `pnpm --filter @coding-usage/core run -r` sees package.
10. [ ] Create `packages/server` folder and `package.json`.
    - Verify: package is listed by workspace command.
11. [ ] Create `packages/cli` folder and `package.json`.
    - Verify: package is listed by workspace command.
12. [ ] Create `packages/mcp` folder and `package.json`.
    - Verify: package is listed by workspace command.
13. [ ] Create `packages/web` folder and `package.json`.
    - Verify: package is listed by workspace command.
14. [ ] Add `src/index.ts` to each package.
    - Verify: each package compiles with `tsc --noEmit`.
15. [ ] Install dependencies.
    - Verify: `pnpm install` exits 0.
16. [ ] Run workspace typecheck.
    - Verify: `pnpm -r typecheck` exits 0.
17. [ ] Run workspace tests.
    - Verify: `pnpm -r test` executes test runners (initially minimal).
18. [ ] Run workspace build.
    - Verify: `pnpm -r build` exits 0.

## B. Contracts and Canonical Model

19. [ ] Create `docs/contracts/provider-adapter-interface.md`.
    - Verify: file contains required sections (inputs, outputs, errors, freshness).
20. [ ] Create `docs/contracts/canonical-quota-model.md`.
    - Verify: includes `UsageRecord`, `QuotaSnapshot`, `QuotaRule`.
21. [ ] Create `docs/contracts/window-semantics.md`.
    - Verify: includes rolling/fixed/budget/balance definitions.
22. [ ] Add `known|unknown|stale` freshness semantics.
    - Verify: all contract docs reference same terminology.
23. [ ] Add scope rules (`personal|org|project|workspace`).
    - Verify: scope table exists with examples.
24. [ ] Add idempotency key format rule.
    - Verify: regex/pseudocode included.
25. [ ] Add provider confidence tier definitions.
    - Verify: high/medium/low criteria documented.
26. [ ] Add rejection rules (scraping discouraged).
    - Verify: anti-pattern section exists.

## C. Database and Migration Layer

27. [ ] Create `packages/core/src/database/schema.ts`.
    - Verify: exports schema SQL or table builder.
28. [ ] Create `packages/core/src/database/migrations.ts`.
    - Verify: migration runner callable from tests.
29. [ ] Create `packages/core/src/database/db.ts`.
    - Verify: DB init returns usable connection.
30. [ ] Add migration test file.
    - Verify: test can run via package test command.
31. [ ] Write failing test: fresh init creates all tables.
    - Verify: test fails before implementation.
32. [ ] Implement table creation logic.
    - Verify: test now passes.
33. [ ] Write failing test: idempotent migration rerun.
    - Verify: fails before idempotency guard.
34. [ ] Add idempotency guard.
    - Verify: rerun test passes.
35. [ ] Write failing test: version upgrade path.
    - Verify: fails before version handling.
36. [ ] Implement version tracking table.
    - Verify: upgrade test passes.
37. [ ] Add indexes for provider+timestamp lookups.
    - Verify: migration test asserts index presence.
38. [ ] Add `provider_health` and `adapter_sync_state` tables.
    - Verify: introspection query returns both tables.
39. [ ] Add `reconciliation_runs` table.
    - Verify: table exists and insert works.
40. [ ] Run all DB tests.
    - Verify: `pnpm --filter @coding-usage/core test` exits 0.

## D. Quota Engine Core

41. [ ] Create quota type definitions.
    - Verify: exported types compile.
42. [ ] Create window calculation utilities.
    - Verify: module test imports compile.
43. [ ] Create quota engine class.
    - Verify: class can be instantiated in test.
44. [ ] Write failing test: rolling 5h window boundaries.
    - Verify: fails before logic.
45. [ ] Implement rolling window logic.
    - Verify: test passes.
46. [ ] Write failing test: fixed monthly reset.
    - Verify: fails before anchor logic.
47. [ ] Implement fixed reset anchor logic.
    - Verify: test passes.
48. [ ] Write failing test: stale data must not be zeroed.
    - Verify: fails before stale handling.
49. [ ] Implement stale-state propagation.
    - Verify: test passes.
50. [ ] Write failing test: unknown data blocks hard alerts.
    - Verify: fails before unknown policy.
51. [ ] Implement unknown-state policy.
    - Verify: test passes.
52. [ ] Add predictive exhaustion helper.
    - Verify: deterministic fixture test passes.
53. [ ] Persist snapshots from engine loop.
    - Verify: snapshot rows increase after evaluation.
54. [ ] Run quota test suite.
    - Verify: all quota tests pass.

## E. Adapter Framework and Provider Implementations

55. [ ] Create adapter base interfaces.
    - Verify: compile in strict mode.
56. [ ] Create adapter registry.
    - Verify: registry resolves known adapters in test.
57. [ ] Add health bookkeeping fields.
    - Verify: health state updates on mock failure.

### OpenAI
58. [ ] Write failing OpenAI fixture mapping test.
    - Verify: test fails pre-implementation.
59. [ ] Implement OpenAI usage mapper.
    - Verify: fixture test passes.
60. [ ] Add admin-key requirement test.
    - Verify: regular key path returns controlled error.

### OpenRouter
61. [ ] Write failing OpenRouter credits fixture test.
    - Verify: fails before mapper.
62. [ ] Implement credits mapper and remaining calc.
    - Verify: passes fixture test.
63. [ ] Add management-key caveat test.
    - Verify: missing scope handled explicitly.

### DeepSeek
64. [ ] Write failing DeepSeek multi-currency test.
    - Verify: fails pre-implementation.
65. [ ] Implement DeepSeek balance mapper.
    - Verify: test passes.

### SiliconFlow
66. [ ] Write failing SiliconFlow user-info test.
    - Verify: fails pre-implementation.
67. [ ] Implement SiliconFlow mapper.
    - Verify: test passes.

### Minimax
68. [ ] Write failing Minimax remains endpoint test.
    - Verify: fails pre-implementation.
69. [ ] Implement Minimax mapper.
    - Verify: test passes.
70. [ ] Add key-type mismatch test.
    - Verify: controlled error path passes test.

### Anthropic
71. [ ] Write failing Anthropic OAuth usage test.
    - Verify: fails pre-implementation.
72. [ ] Implement Anthropic OAuth mapper.
    - Verify: test passes.
73. [ ] Add optional admin usage mode test.
    - Verify: mode switching test passes.

### GitHub Copilot
74. [ ] Write failing Copilot personal usage fixture test.
    - Verify: fails pre-implementation.
75. [ ] Implement personal usage mapper.
    - Verify: test passes.
76. [ ] Add org metrics fixture test.
    - Verify: fails before org mapping.
77. [ ] Implement org metrics mapper.
    - Verify: test passes.

### Gemini + Gemini CLI
78. [ ] Write failing Gemini quota mapping test.
    - Verify: fails pre-implementation.
79. [ ] Implement Gemini quota mapper.
    - Verify: test passes.
80. [ ] Write failing Gemini CLI telemetry parser test.
    - Verify: fails pre-implementation.
81. [ ] Implement telemetry parser.
    - Verify: test passes.

### Zhipu GLM + Kimi
82. [ ] Write failing GLM fallback-path test.
    - Verify: fails pre-implementation.
83. [ ] Implement GLM mapper with confidence flag.
    - Verify: test passes.
84. [ ] Write failing Kimi balance mapping test.
    - Verify: fails pre-implementation.
85. [ ] Implement Kimi mapper.
    - Verify: test passes.

86. [ ] Run all adapter tests.
    - Verify: provider adapter test suite exits 0.

## F. Proxy Collector

87. [ ] Create proxy server skeleton.
    - Verify: server boot test passes.
88. [ ] Add routing rules by host pattern.
    - Verify: route unit test passes.
89. [ ] Write failing OpenAI extraction test.
    - Verify: fails pre-extractor.
90. [ ] Implement OpenAI extractor.
    - Verify: test passes.
91. [ ] Write failing Anthropic extraction test.
    - Verify: fails pre-extractor.
92. [ ] Implement Anthropic extractor.
    - Verify: test passes.
93. [ ] Write failing Gemini extraction test.
    - Verify: fails pre-extractor.
94. [ ] Implement Gemini extractor.
    - Verify: test passes.
95. [ ] Persist extracted records to DB.
    - Verify: integration test sees inserted rows.
96. [ ] Enforce localhost-only bind.
    - Verify: config test rejects non-local bind by default.

## G. Log Collectors

97. [ ] Create source discovery map.
    - Verify: test returns known default paths per OS.
98. [ ] Write failing Claude log parser test.
    - Verify: fails pre-parser.
99. [ ] Implement Claude parser.
    - Verify: test passes.
100. [ ] Write failing Codex parser test.
     - Verify: fails pre-parser.
101. [ ] Implement Codex parser.
     - Verify: test passes.
102. [ ] Write failing OpenCode parser test.
     - Verify: fails pre-parser.
103. [ ] Implement OpenCode parser.
     - Verify: test passes.
104. [ ] Write failing Cursor parser test.
     - Verify: fails pre-parser.
105. [ ] Implement Cursor parser.
     - Verify: test passes.
106. [ ] Add incremental cursor/watermark logic.
     - Verify: second scan processes only new records.
107. [ ] Add daily immutable summary update.
     - Verify: historical-day mutation test fails as expected.

## H. Alert Engine

108. [ ] Write failing threshold-crossing alert test.
     - Verify: fails before engine logic.
109. [ ] Implement threshold crossing logic.
     - Verify: test passes.
110. [ ] Write failing hysteresis anti-flap test.
     - Verify: fails pre-hysteresis.
111. [ ] Implement hysteresis state machine.
     - Verify: test passes.
112. [ ] Write failing cooldown dedupe test.
     - Verify: fails pre-cooldown.
113. [ ] Implement cooldown + dedupe.
     - Verify: test passes.
114. [ ] Add desktop channel implementation.
     - Verify: mocked notifier invocation test passes.
115. [ ] Add webhook channel implementation.
     - Verify: mocked HTTP post test passes.
116. [ ] Add email channel implementation.
     - Verify: mocked SMTP send test passes.
117. [ ] Persist delivery receipts.
     - Verify: DB rows include channel statuses.

## I. Config System

118. [ ] Create `config/providers.yaml` template.
     - Verify: schema validation passes.
119. [ ] Create `config/quota-rules.yaml` template.
     - Verify: schema validation passes.
120. [ ] Create `config/notifications.yaml` template.
     - Verify: schema validation passes.
121. [ ] Write failing invalid-config test.
     - Verify: invalid file is rejected.
122. [ ] Implement config loader with precedence.
     - Verify: env override test passes.
123. [ ] Implement `configVersion` migration hook.
     - Verify: old config fixture upgrades successfully.
124. [ ] Add secret refs `${ENV_VAR}`.
     - Verify: resolution test passes.

## J. API and Scheduler

125. [ ] Add `/api/status` route.
     - Verify: route test returns expected schema.
126. [ ] Add `/api/trends` route.
     - Verify: route test returns chart-ready points.
127. [ ] Add `/api/alerts` route.
     - Verify: route test returns active alerts.
128. [ ] Add `/api/providers` route.
     - Verify: route test supports list/update.
129. [ ] Add scheduler polling loop.
     - Verify: test asserts poll jobs are scheduled.
130. [ ] Add scheduler quota loop.
     - Verify: snapshot count increases in integration test.
131. [ ] Add scheduler alert loop.
     - Verify: alert events created in test fixture.
132. [ ] Add `/api/health` route.
     - Verify: health includes adapter freshness/last sync.

## K. CLI

133. [ ] Add `coding-usage status` command.
     - Verify: snapshot test for table output passes.
134. [ ] Add `coding-usage trend` command.
     - Verify: command test passes with fixture data.
135. [ ] Add `coding-usage alerts` command.
     - Verify: command test passes.
136. [ ] Add `coding-usage provider` command.
     - Verify: add/update/list tests pass.
137. [ ] Add `coding-usage daemon start/stop`.
     - Verify: daemon lifecycle tests pass.
138. [ ] Add global `--json` output mode.
     - Verify: JSON schema tests pass for each read command.

## L. MCP Server

139. [ ] Add `get_quota_status` tool.
     - Verify: MCP tool test returns expected payload.
140. [ ] Add `get_usage_trend` tool.
     - Verify: tool validates provider and days parameters.
141. [ ] Add `check_alerts` tool.
     - Verify: tool returns active alerts list.
142. [ ] Add `quota://dashboard` resource.
     - Verify: resource fetch test returns summary text/html.

## M. Web Dashboard

143. [ ] Create Overview page shell.
     - Verify: page test renders empty/loading states.
144. [ ] Render provider cards with percent/reset.
     - Verify: snapshot test passes.
145. [ ] Create Trends page shell.
     - Verify: line chart receives fixture points.
146. [ ] Add range selector (7/30/90 days).
     - Verify: query parameter changes and fetch test passes.
147. [ ] Create Alerts page shell.
     - Verify: list + filters render in test.
148. [ ] Add alert acknowledge action.
     - Verify: action test updates list state.
149. [ ] Create Settings page shell.
     - Verify: provider/rule/channel forms render.
150. [ ] Add config save flow.
     - Verify: mocked API update test passes.

## N. Desktop (Optional Delivery Track)

151. [ ] Bootstrap Tauri app shell.
     - Verify: `tauri dev` starts app window.
152. [ ] Add tray icon states.
     - Verify: tray state test/mocked status mapping passes.
153. [ ] Add tray quick-status view.
     - Verify: menu action opens status panel.
154. [ ] Add native notification bridge.
     - Verify: test fires on critical alert fixtures.
155. [ ] Add sidecar process control.
     - Verify: start/stop hooks pass integration test.

## O. Reconciliation and Release Gates

156. [ ] Implement reconciliation worker.
     - Verify: drift calculation test passes.
157. [ ] Add provider-specific drift thresholds.
     - Verify: threshold policy tests pass.
158. [ ] Add confidence downgrade on persistent drift.
     - Verify: health state transition test passes.
159. [ ] Add secret redaction utility.
     - Verify: redaction tests block key leakage.
160. [ ] Add retention job (raw 90d, summary 365d).
     - Verify: retention test deletes expected rows only.
161. [ ] Add E2E mixed-provider scenario.
     - Verify: `tests/e2e/provider-matrix.e2e.ts` passes.
162. [ ] Add E2E alert noise scenario.
     - Verify: `tests/e2e/alert-behavior.e2e.ts` passes.
163. [ ] Run full pipeline.
     - Verify: `pnpm -r test && pnpm -r typecheck && pnpm -r build` exits 0.
164. [ ] Freeze release checklist.
     - Verify: `docs/release/checklist.md` all required items checked.

## P. Handoff Completion

165. [ ] Confirm design doc updated references still valid.
     - Verify: all file paths in docs resolve.
166. [ ] Confirm implementation plan and micro checklist are aligned.
     - Verify: no missing task families.
167. [ ] Confirm README points to latest docs.
     - Verify: links/paths exist.
168. [ ] Confirm license and gitignore are present.
     - Verify: files exist in repo root.
169. [ ] Confirm repository clean before final handoff commit.
     - Verify: `git status` clean.
170. [ ] Tag handoff milestone.
     - Verify: `git tag -a handoff-v1 -m "Handoff v1"` (optional) succeeds.
