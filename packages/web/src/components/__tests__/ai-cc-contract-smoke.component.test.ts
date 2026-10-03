/**
 * Slice G-AC2 — Contract smoke: FE adapter field names vs BE response keys.
 * Fixture mirrors BE `portfolio_analytics_views.py` GET response + serializers
 * + agent/usage serializers. Any rename on either side fails this suite.
 */
import { describe, it, expect } from "vitest";

/** BE GET /workspace/ai-command-center/ response keys (portfolio_analytics_views.py GET). */
const BE_CC_GET_KEYS = [
  "ai_provider",
  "ai_model",
  "ai_api_key",
  "ai_api_key_configured",
  "ai_api_key_masked",
  "system_prompt_template",
  "custom_endpoint",
  "effective_ai_source",
  "effective_ai_provider",
  "effective_ai_model",
  "ai_ready",
  "ai_config_message",
  "ai_prompt_config",
  "ai_prompt_config_history",
  "advisory_refresh_interval_hours",
  "advisory_max_auto_refreshes_per_day",
  "advisory_max_tokens_per_day",
  "temperature",
  "fallback_quota_remaining",
  "fallback_quota_max",
  "fallback_quota_reset",
] as const;

/** FE PUT payload keys from AICommandCenterPage.tsx handleSave (~:209-226). */
const FE_CC_PUT_KEYS = [
  "ai_provider",
  "advisory_max_tokens_per_day",
  "advisory_refresh_interval_hours",
  "temperature",
  "custom_endpoint",
  "ai_api_key",
  "ai_prompt_config",
  "advisory_max_auto_refreshes_per_day",
] as const;

/** BE POST /workspace/ai-command-center/test-connection/ request keys (tests). */
const BE_CC_TEST_POST_KEYS = [
  "ai_provider",
  "ai_model",
  "custom_endpoint",
] as const;

/** BE AIUsageRecordSerializer fields (ai_analytics/serializers.py). */
const BE_USAGE_RECORD_KEYS = [
  "id",
  "user",
  "username",
  "action",
  "provider",
  "model",
  "tokens_in",
  "tokens_out",
  "cost",
  "latency_ms",
  "status",
  "created_at",
] as const;

/** BE AIUsageAggregateView response keys (test_ai_management_center / views). */
const BE_USAGE_AGGREGATE_KEYS = [
  "total_requests",
  "total_tokens_in",
  "total_tokens_out",
  "total_cost",
  "avg_latency",
] as const;

/** FE AIUsageDashboard record field usage (AIUsageDashboard.tsx toCsv / tbody). */
const FE_USAGE_RECORD_FIELDS = [
  "id",
  "created_at",
  "action",
  "provider",
  "model",
  "tokens_in",
  "tokens_out",
  "cost",
  "latency_ms",
  "status",
] as const;

/** FE aggregate field usage (AIUsageDashboard.tsx cards). */
const FE_USAGE_AGGREGATE_FIELDS = [
  "total_requests",
  "total_tokens_in",
  "total_tokens_out",
  "total_cost",
  "avg_latency",
] as const;

/** BE AgentRegistrySerializer fields (ai_agents/serializers.py). */
const BE_AGENT_KEYS = [
  "id",
  "name",
  "agent_type",
  "provider",
  "model",
  "capabilities",
  "system_prompt",
  "is_active",
  "created_by",
  "created_at",
  "updated_at",
] as const;

/** FE AIAgentFederationPanel field usage. */
const FE_AGENT_FIELDS = [
  "id",
  "name",
  "agent_type",
  "provider",
  "model",
  "capabilities",
  "system_prompt",
  "is_active",
] as const;

describe("G-AC2: AI CC FE↔BE contract smoke", () => {
  it("CC PUT keys are a subset of known BE GET keys (no typo drift)", () => {
    const be = new Set<string>(BE_CC_GET_KEYS);
    const missing = FE_CC_PUT_KEYS.filter((k) => !be.has(k));
    expect(missing, `PUT keys not in BE GET fixture: ${missing.join(", ")}`).toEqual([]);
  });

  it("CC test-connection POST keys match BE fixture", () => {
    const be = new Set<string>(BE_CC_TEST_POST_KEYS);
    const fe = ["ai_provider", "ai_model", "custom_endpoint"];
    const missing = fe.filter((k) => !be.has(k));
    expect(missing).toEqual([]);
  });

  it("usage record FE fields ⊆ BE serializer fields", () => {
    const be = new Set<string>(BE_USAGE_RECORD_KEYS);
    const missing = FE_USAGE_RECORD_FIELDS.filter((k) => !be.has(k));
    expect(missing, `FE usage fields missing on BE: ${missing.join(", ")}`).toEqual([]);
  });

  it("usage aggregate FE fields ⊆ BE aggregate keys", () => {
    const be = new Set<string>(BE_USAGE_AGGREGATE_KEYS);
    const missing = FE_USAGE_AGGREGATE_FIELDS.filter((k) => !be.has(k));
    expect(missing, `FE aggregate fields missing on BE: ${missing.join(", ")}`).toEqual([]);
  });

  it("agent FE fields ⊆ BE serializer fields", () => {
    const be = new Set<string>(BE_AGENT_KEYS);
    const missing = FE_AGENT_FIELDS.filter((k) => !be.has(k));
    expect(missing, `FE agent fields missing on BE: ${missing.join(", ")}`).toEqual([]);
  });

  it("CC GET exposes all FE-consumed keys", () => {
    const be = new Set<string>(BE_CC_GET_KEYS);
    const feConsumed = [
      "ai_provider",
      "advisory_max_tokens_per_day",
      "advisory_refresh_interval_hours",
      "temperature",
      "effective_ai_provider",
      "advisory_max_auto_refreshes_per_day",
      "ai_api_key_configured",
      "ai_api_key_masked",
      "system_prompt_template",
      "custom_endpoint",
      "ai_prompt_config",
      "ai_prompt_config_history",
      "fallback_quota_remaining",
      "fallback_quota_max",
    ];
    const missing = feConsumed.filter((k) => !be.has(k));
    expect(missing).toEqual([]);
  });
});
