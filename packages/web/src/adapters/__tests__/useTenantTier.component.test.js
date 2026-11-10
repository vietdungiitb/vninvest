/**
 * S8b — useTenantTier mapping (P3.4). Pure function tests, khong can BE.
 *
 * Quyet dinh §1 PLAN_P34_TIER_20261110: Subscription.plan lam source of truth.
 * enterprise/internal/custom -> enterprise; pro -> pro; con lai + 403/thieu
 * subscription/status khong active|trialing -> free (fail-closed).
 */
import { describe, it, expect } from "vitest";
import { mapPlanToTier, resolveTierFromSubscription } from "../useTenantTier.js";

describe("useTenantTier mapping (P3.4)", () => {
  it("mapPlanToTier: pro -> pro", () => {
    expect(mapPlanToTier("pro")).toBe("pro");
  });

  it("mapPlanToTier: enterprise/internal/custom -> enterprise", () => {
    expect(mapPlanToTier("enterprise")).toBe("enterprise");
    expect(mapPlanToTier("internal")).toBe("enterprise");
    expect(mapPlanToTier("custom")).toBe("enterprise");
  });

  it("mapPlanToTier: free/starter/unknown -> free (fail-closed)", () => {
    expect(mapPlanToTier("free")).toBe("free");
    expect(mapPlanToTier("starter")).toBe("free");
    expect(mapPlanToTier("unknown-plan")).toBe("free");
    expect(mapPlanToTier(null)).toBe("free");
    expect(mapPlanToTier(undefined)).toBe("free");
  });

  it("resolveTierFromSubscription: active|trialing moi tinh, con lai free", () => {
    expect(resolveTierFromSubscription({ plan: "pro", status: "active" })).toBe("pro");
    expect(resolveTierFromSubscription({ plan: "enterprise", status: "trialing" })).toBe("enterprise");
    expect(resolveTierFromSubscription({ plan: "pro", status: "cancelled" })).toBe("free");
    expect(resolveTierFromSubscription({ plan: "pro", status: "past_due" })).toBe("free");
    expect(resolveTierFromSubscription(null)).toBe("free");
    expect(resolveTierFromSubscription(undefined)).toBe("free");
    expect(resolveTierFromSubscription({})).toBe("free");
  });
});
