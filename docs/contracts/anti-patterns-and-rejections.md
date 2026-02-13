# Anti-patterns and Rejection Rules

> **Version:** 1.0.0
> **Status:** Stable
> **Last Updated:** 2026-02-13

## Overview

This document specifies patterns and approaches that are explicitly **rejected** for the coding-usage project. These anti-patterns have been considered and deliberately avoided based on lessons from similar tools.

## Rejected Approaches

### 1. Web Scraping for Usage Data ❌

**Pattern:** Writing HTML parsers to extract usage from provider web dashboards.

**Why Rejected:**
- Fragile: Any HTML change breaks the scraper
- High maintenance: Requires constant updates
- Legal risk: May violate Terms of Service
- Unreliable: CAPTCHA, login walls, rate limits
- Slow: Page loads are slower than API calls
- Authentication complexity: Requires session management

**Alternatives:**
- Use official documented APIs (even if limited)
- Accept data gaps for providers without APIs
- Allow users to manually import usage data
- Implement proxy interception for request counting

**Exception:** Only acceptable if:
- Provider explicitly documents scraping as integration method
- Scraping is performed against user's own account (self-bot)
- No official API exists

---

### 2. Shared/SaaS Database ❌

**Pattern:** Storing usage data in cloud database (Firebase, Supabase, PostgreSQL on Railway, etc.).

**Why Rejected:**
- Violates **local-first** principle
- Requires ongoing cost for database hosting
- Privacy concern: Usage data may contain sensitive info
- Vendor lock-in: Difficult to export/migrate
- Network dependency: Cannot work offline
- Authentication overhead: Another layer of access control

**Alternatives:**
- SQLite embedded database (single file, zero-config)
- User's choice of sync: Git commit, Dropbox, Syncthing
- Export/import APIs for data portability

**Rationale:** Users should have full ownership of their usage data.

---

### 3. Background Daemon with GUI ❌

**Pattern:** Required background daemon process with GUI control panel (like "Electron app with bundled Node.js backend").

**Why Rejected:**
- Complexity: Managing process lifecycle, IPC, updates
- Resource usage: Two processes always running
- Debugging difficulty: Separate logs, crash states
- Platform friction: Works differently on Windows vs macOS vs Linux
- Overkill: Most users only need CLI or web dashboard

**Alternatives:**
- Optional daemon: `coding-usage daemon start` (opt-in)
- Web dashboard runs on-demand: `coding-usage dashboard`
- CLI for quick status checks
- MCP server for AI tool integration (stdio mode, no daemon)

**Rationale:** Daemon is optional for advanced users, not mandatory for everyone.

---

### 4. Browser Extension for Request Counting ❌

**Pattern:** Browser extension to intercept API requests from web-based AI tools (ChatGPT, Claude.ai, etc.).

**Why Rejected:**
- Narrow scope: Only captures web usage, not IDE/CLI
- Platform fragmentation: Separate extensions for Chrome/Firefox/Safari
- Review burden: Web store reviews, updates, permissions
- Privacy concerns: Extensions request broad permissions
- Maintenance: 3 extension codebases × frequent updates

**Alternatives:**
- Local proxy server (`localhost:8377`) with routing rules
- IDE-specific log parsers (already handled)
- OAuth usage API polling where available

**Rationale:** Local proxy covers more tools (IDEs, CLIs) with single implementation.

---

### 5. Real-time WebSocket Streaming ❌

**Pattern:** Keeping persistent WebSocket connections open to provider APIs for real-time usage updates.

**Why Rejected:**
- Overkill: Usage updates needed every 5-60 minutes, not milliseconds
- Resource usage: Persistent connections consume bandwidth/battery
- Complexity: Reconnection logic, heartbeat, state sync
- Rate limit risk: More connections = more rate limit hits
- Limited support: Few providers offer WebSocket usage APIs

**Alternatives:**
- Polling every 5-15 minutes (configurable interval)
- Proxy interception for near-instant counting
- Log file watching (fs.watch) for CLIs

**Rationale:** Usage monitoring is inherently time-aggregated, not event-streaming.

---

### 6. Auto-Discovery of Provider Credentials ❌

**Pattern:** Scanning `~/.config`, `~/.env`, system keychains, etc. to find API keys.

**Why Rejected:**
- Security risk: Reading credential files without explicit permission
- False positives: Incorrect key selection leads to confusing errors
- Privacy violation: Users may not want all providers scanned
- Cross-platform complexity: Different paths/formats on Windows/macOS/Linux
- Trust erosion: Users cannot trust tool that accesses secrets without permission

**Alternatives:**
- Explicit config files: `config/providers.yaml`
- Environment variable references: `${OPENAI_API_KEY}`
- Keychain integration: Opt-in, explicit provider selection
- Setup wizard: `coding-usage init` with guided prompts

**Rationale:** Require explicit opt-in for each provider credential.

---

### 7. Custom Scripting Language ❌

**Pattern:** Allowing users to write JavaScript/Python/Lua scripts to fetch usage from custom providers.

**Why Rejected:**
- Complexity: Designing scripting language, sandbox, API
- Security risk: Arbitrary code execution
- Maintenance burden: Debugging user scripts
- Narrow audience: Few users will write custom scripts
- Documentation: Must document scripting API, examples

**Alternatives:**
- Plugin system: TypeScript-based adapters (can be community-contributed)
- HTTP webhook support: Users can build external integrations
- CSV import: Manual data import for edge cases

**Exception:** MAY consider in future if:
- At least 10 providers requested by community
- Clear pattern emerges (not just one-off requests)

---

### 8. Predictive Alerts by Default ❌

**Pattern:** Automatically enabling "you'll run out in 2 days" alerts for all providers.

**Why Rejected:**
- False confidence: Linear extrapolation is often wrong
- Alert fatigue: Users ignore alerts if they're inaccurate
- Complexity: Requires minimum data threshold, confidence intervals
- Privacy: Need to store usage history for prediction

**Alternatives:**
- Opt-in prediction: User enables "exhaustion predictions" per provider
- Confidence display: Show prediction with "? days (low confidence)" label
- Threshold alerts: Focus on 70%/85%/95% usage alerts

**Rationale:** Predictions are helpful hints, not reliable alerts.

---

## Allowed Patterns (with Guardrails)

### 1. Local Proxy Interception ✅

**Pattern:** HTTP proxy server intercepting AI tool requests.

**Guardrails:**
- Bind to `localhost` only (never 0.0.0.0)
- Explicit routing rules (not catch-all)
- Read-only (don't modify requests/responses except logging)
- User must configure tools to use proxy (no transparent hijacking)

**Why Allowed:**
- Captures usage from IDEs, CLIs (not just web)
- Single implementation covers many providers
- No web extension complexity
- Works offline (cached data remains available)

---

### 2. Log File Parsing ✅

**Pattern:** Reading log files from AI tools (Claude Code, Gemini CLI, etc.).

**Guardrails:**
- Read-only (never modify log files)
- Platform-aware paths (Windows/macOS/Linux differences)
- Incremental parsing (track cursor to avoid re-reading entire files)
- Immutable daily summaries (don't mutate historical days)

**Why Allowed:**
- Covers CLI tools not reachable by proxy
- Zero configuration if logs in default locations
- Low resource usage (parsing text files)

---

### 3. OAuth for Provider Auth ✅

**Pattern:** Using OAuth 2.0 to authenticate with providers (Anthropic, etc.).

**Guardrails:**
- Local server callback (localhost:3000)
- Token stored in local SQLite (never sent to remote)
- Refresh token handled transparently
- Clear logout/revocation flow

**Why Allowed:**
- Avoids embedding long-lived API keys in config
- Can access user-scoped usage (not just org admin)
- Standard protocol (well-understood security model)

---

### 4. Community Provider Adapters ✅

**Pattern:** Accepting TypeScript-based adapter implementations from community.

**Guardrails:**
- Code review: Must pass interface contract tests
- Sandboxing: Adapter runs in same process (no separate execution)
- Versioning: Clear semver for adapter breaking changes
- Badge system: Mark as "official" vs "community"

**Why Allowed:**
- Extends coverage without maintainer effort
- TypeScript compilation catches many errors
- Can promote community adapters to official if stable

---

## Decision Framework

When evaluating new features or approaches, use this checklist:

### Required (all must pass)
- [ ] Maintains local-first principle
- [ ] Respects user privacy (no silent credential scanning)
- [ ] Works offline (cached data accessible)
- [ ] Cross-platform compatible (Windows/macOS/Linux)

### Preferred (at least 3)
- [ ] Zero external service dependencies
- [ ] Simple mental model (easy to understand)
- [ ] Low maintenance burden
- [ ] Clear upgrade path
- [ ] Debuggable (transparent errors)

### Rejected (any fails)
- [ ] Requires web scraping (reverse-engineering)
- [ ] Vendor lock-in (difficult data export)
- [ ] Background daemon requirement
- [ ] Arbitrary code execution

## References

- **cc-switch:** Local proxy pattern (accepted)
- **toktrack:** Log parsing pattern (accepted)
- **LiteLLM:** Rejected: SaaS requirement, complex setup
- **Langfuse:** Rejected: Cloud-hosted, team-focused
