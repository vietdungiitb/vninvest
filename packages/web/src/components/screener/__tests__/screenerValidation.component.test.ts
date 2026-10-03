import { describe, it, expect } from "vitest";
import { validateConditionValue, getFieldSpec } from "../screenerValidation.js";

describe("validateConditionValue (P0.3 R3.1/R3.2)", () => {
  it("flags cleared/empty values as required", () => {
    expect(validateConditionValue("rsi_14", ""))?.toMatchObject({ kind: "required" });
    expect(validateConditionValue("rsi_14", null))?.toMatchObject({ kind: "required" });
    expect(validateConditionValue("rsi_14", undefined))?.toMatchObject({ kind: "required" });
  });

  it("flags non-finite values as number errors", () => {
    expect(validateConditionValue("rsi_14", NaN))?.toMatchObject({ kind: "number" });
    expect(validateConditionValue("close", Infinity))?.toMatchObject({ kind: "number" });
  });

  it("enforces 0-100 domains (RSI, stochastic, MFI, ADX)", () => {
    expect(validateConditionValue("rsi_14", 150))?.toMatchObject({ kind: "range", min: 0, max: 100 });
    expect(validateConditionValue("rsi_14", -1))?.toMatchObject({ kind: "range" });
    expect(validateConditionValue("rsi_14", 30)).toBeNull();
    expect(validateConditionValue("stochastic_k", 101))?.toMatchObject({ kind: "range" });
    expect(validateConditionValue("mfi_14", 50)).toBeNull();
  });

  it("enforces non-negative volumes and 0-100 pct fields", () => {
    expect(validateConditionValue("volume_rvol", -1))?.toMatchObject({ kind: "range", min: 0 });
    expect(validateConditionValue("volume_rvol", 2.5)).toBeNull();
    expect(validateConditionValue("whale_buy_pct", 120))?.toMatchObject({ kind: "range", max: 100 });
    expect(validateConditionValue("range_position_pct", 50)).toBeNull();
  });

  it("accepts any finite number for unbounded fields and unknown fields", () => {
    expect(validateConditionValue("momentum_20d_pct", -250)).toBeNull();
    expect(validateConditionValue("whale_net_value", 1e12)).toBeNull();
    // BE-only field outside the picker registry: finite check only
    expect(validateConditionValue("whale_buy_value", 5)).toBeNull();
    expect(validateConditionValue("whale_buy_value", NaN))?.toMatchObject({ kind: "number" });
  });
});

describe("getFieldSpec", () => {
  it("resolves picker defaults used by the toggle", () => {
    expect(getFieldSpec("rsi_14"))?.toMatchObject({ defaultOp: "lt", defaultValue: 30 });
    expect(getFieldSpec("whale_buy_pct"))?.toMatchObject({ defaultOp: "gt", defaultValue: 60 });
    expect(getFieldSpec("no_such_field")).toBeUndefined();
  });
});
