/**
 * W-A — mapper V2 session -> legacy AdvisoryResult (fail-before).
 * Widget 0.4.4 khong forward `advisorySession` xuong bottom panel
 * (dist/index.js: advisorySession dung 1 lan o destructure Tp),
 * nen app phai map V2 -> AdvisoryResult truoc khi truyen prop.
 */
import { describe, it, expect } from "vitest";
import { mapAdvisorySessionToResult } from "../VNInvestSignalAdapter.js";

function makeComponent(over = {}) {
  return {
    id: 1,
    symbol: "VCB",
    component_type: "indicator",
    indicator_name: "RSI",
    status: "neutral",
    confidence_score: 7,
    suggested_action: "watch",
    rationale_text: "RSI trung tinh",
    timeframe: "30m",
    include_in_summary: true,
    is_deleted: false,
    created_at: "2026-11-12T00:00:00+07:00",
    updated_at: "2026-11-12T00:00:00+07:00",
    ...over,
  };
}

function makeSession(over = {}) {
  return {
    queued: false,
    symbol: "VCB",
    contract_version: "v2",
    strategy_action: "buy",
    risk_level: "low",
    confidence_score: 7.5,
    advisory: { advisory_text: "Phan tich native cho VCB: buy." },
    aggregate: {
      advisory_id: "11111111-2222-3333-4444-555555555555",
      session_date: "2026-11-12",
      selected_trade_date: "2026-11-12",
      contract_version: "v2",
      decision: { action: "buy", risk: "low", score_band: "high", score: 0.75 },
    },
    components: [
      makeComponent({ id: 1, indicator_name: "RSI", status: "neutral", confidence_score: 7, suggested_action: "watch", rationale_text: "RSI trung tinh" }),
      makeComponent({ id: 2, indicator_name: "Whale Flow", status: "bullish", confidence_score: 8, suggested_action: "follow", rationale_text: "Dong tien lon vao" }),
      makeComponent({ id: 3, indicator_name: "Executive Summary", status: "informative", confidence_score: 6, suggested_action: "hold", rationale_text: "Tong hop", include_in_summary: false }),
    ],
    deleted_components: [],
    executive_summary: {
      symbol: "VCB",
      session_date: "2026-11-12",
      strategy_action: "buy",
      risk_level: "low",
      overall_confidence: 7.5,
      score_band: "high",
      summary_text: "Phan tich native cho VCB: buy.",
      component_ids: [1, 2],
      active_components_count: 2,
      source: "native",
    },
    executive_summaries: [],
    user_ai_provider: "core-native",
    effective_ai_provider: "core-native",
    effective_ai_model: "",
    effective_ai_source: "native",
    ...over,
  };
}

describe("W-A — mapAdvisorySessionToResult", () => {
  it("null khi session falsy", () => {
    expect(mapAdvisorySessionToResult(null)).toBeNull();
    expect(mapAdvisorySessionToResult(undefined)).toBeNull();
  });

  it("null khi empty-state (no_advisory_data, aggregate null)", () => {
    expect(
      mapAdvisorySessionToResult({ queued: false, reason: "no_advisory_data", advisory: null, aggregate: null, components: [] })
    ).toBeNull();
  });

  it("M-1: null khi queued=true ke ca khi co aggregate default (tranh flash SELL gia sau refresh)", () => {
    const s = makeSession({
      queued: true,
      aggregate: {
        advisory_id: "x",
        session_date: "2026-11-12",
        contract_version: "v1",
        decision: { action: "reduce", risk: "high", score_band: "low", score: 0.5 },
      },
      components: [],
    });
    expect(mapAdvisorySessionToResult(s)).toBeNull();
  });

  it("null khi khong còn component non-deleted", () => {
    const s = makeSession({ components: [makeComponent({ id: 9, is_deleted: true })] });
    expect(mapAdvisorySessionToResult(s)).toBeNull();
  });

  it("map BUY: decision/confidence/weighted_score + agents (follow->BUY, loai summary include_in_summary=false)", () => {
    const r = mapAdvisorySessionToResult(makeSession());
    expect(r).not.toBeNull();
    expect(r.decision).toBe("BUY");
    expect(r.confidence).toBeCloseTo(0.75, 5);
    expect(r.weighted_score).toBeCloseTo(75, 5);
    // Chi 2 agent dong gop (Executive Summary include_in_summary=false bi loai)
    expect(r.agents).toHaveLength(2);
    expect(r.agents.map((a) => a.name)).toEqual(["RSI", "Whale Flow"]);
    // follow + status bullish -> BUY chu khong phai HOLD
    const whale = r.agents.find((a) => a.name === "Whale Flow");
    expect(whale.signal).toBe("BUY");
    expect(whale.score).toBe(80);
    expect(r.explanation).toContain("VCB");
    expect(r.triggered_at).toContain("2026-11-12");
  });

  it("map reduce -> SELL voi weighted_score am", () => {
    const s = makeSession({
      strategy_action: "reduce",
      aggregate: {
        advisory_id: "y",
        session_date: "2026-11-12",
        contract_version: "v2",
        decision: { action: "reduce", risk: "high", score_band: "low", score: 0.4 },
      },
      executive_summary: {
        symbol: "VCB",
        session_date: "2026-11-12",
        strategy_action: "reduce",
        risk_level: "high",
        overall_confidence: 4,
        score_band: "low",
        summary_text: "Rui ro cao.",
        component_ids: [1],
        active_components_count: 1,
        source: "native",
      },
      components: [makeComponent({ id: 1, status: "bearish", confidence_score: 6, suggested_action: "reduce" })],
    });
    const r = mapAdvisorySessionToResult(s);
    expect(r.decision).toBe("SELL");
    expect(r.weighted_score).toBeCloseTo(-40, 5);
  });

  it("M-3: triggered_at khong sinh gio ao UTC (giu ngay phien VN)", () => {
    const r = mapAdvisorySessionToResult(makeSession());
    // session_date date-only -> neo +07:00, khong de Date parse UTC hien 07:00 ao
    expect(r.triggered_at).toContain("T00:00:00+07:00");
  });

  it("weight chia deu 1/n tren tap non-deleted", () => {
    const r = mapAdvisorySessionToResult(makeSession());
    expect(r.agents[0].weight).toBeCloseTo(0.5, 5);
    expect(r.agents[1].weight).toBeCloseTo(0.5, 5);
  });
});
