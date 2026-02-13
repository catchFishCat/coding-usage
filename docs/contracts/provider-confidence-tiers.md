# Provider Confidence Tiers

> **Version:** 1.0.0
> **Status:** Stable
> **Last Updated:** 2026-02-13

## Overview

Provider confidence tiers indicate the reliability and stability of usage data from each provider. This helps users understand which providers have high-quality, documented APIs versus those with unstable or undocumented behavior.

## Tier Definitions

### High Confidence

**Definition:** Provider has well-documented, stable usage/limit API with predictable response format.

**Criteria:**
- ✅ Official, publicly documented usage/limit endpoint
- ✅ Stable response format (no frequent breaking changes)
- ✅ Open-source implementation examples available
- ✅ Rate limits documented and enforced
- ✅ Authentication well-specified (API keys, OAuth, etc.)

**Examples:**

| Provider | Endpoint | Documentation |
|----------|----------|---------------|
| OpenAI | `/organization/usage` | [docs.openai.com](https://platform.openai.com/docs/api-reference/usage) |
| OpenRouter | `/api/v1/credits` | [openrouter.ai/docs](https://openrouter.ai/docs#quick-start) |
| DeepSeek | `/user/balance` | [platform.deepseek.com](https://platform.deepseek.com/docs) |
| SiliconFlow | `/v1/user/info` | [docs.siliconflow.cn](https://docs.siliconflow.cn/) |

**Rationale:**
- Admin-level keys required for OpenAI usage endpoints (documented security model)
- OpenRouter credits API is core to their business model (unlikely to change)
- DeepSeek balance endpoint used by billing systems (stable contract)
- SiliconFlow user info is part of authentication flow (stable)

**Display Behavior:** Show normal usage data without warnings.

---

### Medium Confidence

**Definition:** Provider has partially documented usage API or scope-restricted access, with moderate risk of format changes.

**Criteria:**
- ⚠️ Usage endpoint exists but documentation is incomplete or unclear
- ⚠️ Endpoint may require special scope (e.g., org admin, billing access)
- ⚠️ Response format may evolve with moderate notice
- ⚠️ Rate limits not clearly documented
- ⚠️ May require non-standard auth (e.g., specific token types)

**Examples:**

| Provider | Endpoint | Caveats |
|----------|----------|---------|
| Anthropic | `/v1/organizations/cost_report` | Requires admin key; OAuth usage windows undocumented |
| Minimax | `/v1/api/.../coding_plan/remaining` | Coding plan key type required; 5h window implicit |
| GitHub Copilot | `/orgs/{org}/copilot/metrics` | Requires org admin; legacy API deprecated 2026-04 |
| Google Gemini | Cloud Billing API | Requires GCP project setup; quota-derived usage |

**Caveats:**

**Anthropic:**
- OAuth usage window (5h/7d) discovered empirically, not documented
- Admin cost_report requires organization admin key (not personal account)
- Response format may add new time buckets without notice

**Minimax:**
- Coding plan endpoint differs from standard API key
- 5-hour sliding window is implicit behavior (not documented)
- May change without notice to premium subscribers

**GitHub Copilot:**
- `/copilot_internal/user` (personal) and `/orgs/{org}/copilot/metrics` (org) are legacy
- GitHub announced deprecation for 2026-04-01
- New Copilot metrics API exists but documentation is sparse

**Google Gemini:**
- Usage derived from Cloud Quota APIs (not direct usage API)
- Requires project-level setup and billing export
- Real-time usage unavailable (24-48 hour latency typical)

**Display Behavior:** Show usage data with "medium confidence" badge, link to caveats.

---

### Low Confidence

**Definition:** Provider lacks official usage API or relies on undocumented/platform-specific behavior.

**Criteria:**
- ❌ No official usage API (must scrape or reverse-engineer)
- ❌ Endpoint behavior discovered empirically
- ❌ May break without notice
- ❌ Response format unstable
- ❌ May violate ToS if automated

**Examples:**

| Provider | Source | Issues |
|----------|--------|-------|
| Zhipu GLM | Platform scraping | No documented usage API; balance-only |
| Moonshot/Kimi | Platform scraping | Balance endpoint sparse; rate limit info inconsistent |

**Zhipu GLM:**
- Official platform displays balance, but no documented API endpoint
- Reverse-engineered endpoints may exist but are not stable
- Coding usage endpoint availability unclear
- May require browser emulation (violates ToS)

**Moonshot/Kimi:**
- Balance endpoint exists but documentation is minimal
- Rate limit info not reliably available
- May rely on web scraping for full usage data
- Provider may block automated access

**Display Behavior:** Show usage data with "low confidence" warning, recommend manual verification.

---

## Confidence Downgrade Triggers

Confidence tier is dynamically adjusted based on adapter health:

| Event | Effect | Recovery |
|-------|--------|----------|
| 3 consecutive failures | Downgrade: high → medium | 5 consecutive successes |
| 7 consecutive failures | Downgrade: medium → low | 10 consecutive successes |
| Parse error (format change) | Immediate downgrade to low | Manual fix required |
| Rate limit consistently hit | No change (adjust interval) | N/A |

**Implementation:**

```typescript
interface AdapterHealth {
  confidence: "high" | "medium" | "low";
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastSuccessTimestamp: number;
}

function updateConfidence(health: AdapterHealth): AdapterHealth {
  // Downgrade on failures
  if (health.consecutiveFailures >= 7) {
    health.confidence = "low";
  } else if (health.consecutiveFailures >= 3 && health.confidence === "high") {
    health.confidence = "medium";
  }

  // Upgrade on successes
  if (health.consecutiveSuccesses >= 10 && health.confidence === "low") {
    health.confidence = "medium";
  } else if (health.consecutiveSuccesses >= 5 && health.confidence === "medium") {
    health.confidence = "high";
  }

  return health;
}
```

---

## Initial Tier Assignment

New adapters start at tier based on documentation quality:

| Evidence | Initial Tier |
|----------|--------------|
| Official docs + SDK examples | High |
| Official docs but sparse/unclear | Medium |
| Community examples, no official docs | Low |
| Reverse-engineered only | Low |

---

## Impact on Alerting

Confidence tier affects alert sensitivity:

| Tier | Alert Behavior |
|------|----------------|
| High | Normal thresholds (e.g., 70%, 85%, 95%) |
| Medium | Add warning badge: "Data from medium-confidence provider" |
| Low | Critical alert only at 95%+; prominent "unreliable data" warning |

**Rationale:** Avoid alert fatigue from providers known to have unstable data.

---

## Provider Tier Matrix

| Provider | Initial Tier | API Access | Documentation Quality | Stability History |
|----------|--------------|-------------|---------------------|------------------|
| OpenAI | **High** | Admin key endpoint | Excellent | No breaking changes in 2+ years |
| OpenRouter | **High** | Management key | Excellent | Stable since 2023 |
| DeepSeek | **High** | API key | Good | No major issues |
| SiliconFlow | **High** | API key | Good | New provider, no history |
| Anthropic | **Medium** | Admin key | Mixed | OAuth windows undocumented |
| Minimax | **Medium** | Coding plan key | Sparse | Implicit 5h window |
| GitHub Copilot | **Medium** | PAT + org scope | Mixed | Legacy API deprecation announced |
| Google Gemini | **Medium** | GCP project | Complex | Requires cloud setup |
| Zhipu GLM | **Low** | Unknown/scraped | Poor | No official API |
| Moonshot/Kimi | **Low** | Unknown/scraped | Poor | Sparse documentation |

---

## References

- [LiteLLM provider support](https://docs.litellm.ai/docs/providers) - 100+ providers, varying quality
- [cc-switch provider scripts](https://github.com/jwasham/cc-switch/tree/main/src/provider-scripts) - Custom JavaScript usage scripts
- [toktrack sources](https://github.com/recognai-dev/toktrack) - Community-maintaned usage trackers

---

## Appendix: Confidence Evaluation Checklist

Use this checklist when assigning tier to new provider:

### High Confidence (all required)
- [ ] Official API documentation exists
- [ ] Usage/limit endpoint is documented
- [ ] Response format is specified (or example provided)
- [ ] Authentication method is clear
- [ ] Rate limits are documented
- [ ] SDK or official client library exists
- [ ] API versioning policy exists
- [ ] Breaking change notice policy exists

### Medium Confidence (at least 3)
- [ ] Usage endpoint exists but documentation is unclear
- [ ] Requires special scope (org admin, billing access)
- [ ] Authentication is non-standard (specific token type)
- [ ] Response format may evolve without notice
- [ ] Rate limits not clearly documented
- [ ] Community examples exist but no official docs
- [ ] API is in beta/preview

### Low Confidence (any)
- [ ] No official documentation
- [ ] Reverse-engineered endpoints
- [ ] Requires web scraping
- [ ] May violate Terms of Service
- [ ] Response format discovered empirically
- [ ] No API versioning
- [ ] Frequent breaking changes

**Scoring:**
- **High:** All items in High Confidence checklist
- **Medium:** At least 3 items in Medium Confidence checklist
- **Low:** Any item in Low Confidence checklist
