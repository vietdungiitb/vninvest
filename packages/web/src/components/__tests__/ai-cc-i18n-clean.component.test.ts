/**
 * R1.3 — i18n sạch: loadError parity, 22 key chết đã xóa, 0 fallback t()||,
 * 0 chuỗi Việt cứng trong 9 file AI CC, promptConfig parity, preset labels.
 *
 * 22 key chết = leftover R0.9 (configMessage/preset*) + panel audit cũ + saving/close/records
 * tenantKeys/...), bronch: sidebar dùng layout.nav.*, catalog dùng routes.*.
 * Verify 2 phương pháp (scanner + git grep từng key mẫu, xem r13-gates).
 */
const DEAD_KEYS: string[] = [
  "aiCommandCenter.configMessage",
  "aiCommandCenter.presets",
  "aiCommandCenter.presetBalanced",
  "aiCommandCenter.presetFlowFirst",
  "aiCommandCenter.presetDeepDive",
  "aiCommandCenter.presetCostControl",
  "aiCommandCenter.sourcesEnabled",
  "aiCommandCenter.technicalIndicators",
  "aiCommandCenter.whaleLookback",
  "aiCommandCenter.enableAll",
  "aiCommandCenter.leanSet",
  "aiCommandCenter.auditLogs",
  "aiCommandCenter.auditDescription",
  "aiCommandCenter.auditFilters",
  "aiCommandCenter.viewJson",
  "aiCommandCenter.page",
  "aiCommandCenter.of",
  "aiCommandCenter.refresh",
  "aiAgentFederation.saving",
  "aiAgentFederation.close",
  "aiUsageAnalytics.records",
  "aiUsageAnalytics.noRecords",
];
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import viDict from "../../i18n/vi.js";
import enDict from "../../i18n/en.js";

const SRC9 = [
  "src/pages/AICommandCenterPage.tsx",
  "src/components/AICommandCenterForm.tsx",
  "src/components/AIAuditLogsPanel.tsx",
  "src/components/AIAgentFederationPanel.tsx",
  "src/components/AIAdvisoryPromptConfigDrawer.js",
  "src/components/AISettingsErrorBoundary.tsx",
  "src/components/AIUsageDashboard.tsx",
  "src/shared/providerModels.ts",
  "src/pages/AIAgentFederationPage.tsx",
];

function flattenKeys(obj: unknown, prefix = ""): Set<string> {
  const keys = new Set<string>();
  if (obj === null || typeof obj !== "object") return keys;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const nested of flattenKeys(v, path)) keys.add(nested);
    } else {
      keys.add(path);
    }
  }
  return keys;
}

function nsKeys(dict: unknown, ns: string): Set<string> {
  const flat = flattenKeys(dict);
  const out = new Set<string>();
  for (const k of flat) {
    if (k === ns || k.startsWith(`${ns}.`)) out.add(k);
  }
  return out;
}

describe("R1.3: i18n sạch AI CC", () => {
  it("AC1: aiCommandCenter.loadError khác rỗng ở vi + en", () => {
    const vi = nsKeys(viDict, "aiCommandCenter");
    const en = nsKeys(enDict, "aiCommandCenter");
    expect(vi.has("aiCommandCenter.loadError")).toBe(true);
    expect(en.has("aiCommandCenter.loadError")).toBe(true);
  });

  it("AC1b: refreshIntervalValue/customModel/type* có ở vi + en", () => {
    for (const ns of ["aiCommandCenter", "aiAgentFederation"] as const) {
      const vi = nsKeys(viDict, ns);
      const en = nsKeys(enDict, ns);
      const want =
        ns === "aiCommandCenter"
          ? ["aiCommandCenter.refreshIntervalValue", "aiCommandCenter.customModel"]
          : [
              "aiAgentFederation.typeAdvisory",
              "aiAgentFederation.typeAnalyst",
              "aiAgentFederation.typeScreener",
              "aiAgentFederation.typeWhale",
              "aiAgentFederation.typeNews",
              "aiAgentFederation.typeCustom",
            ];
      for (const k of want) {
        expect(vi.has(k), `vi thiếu ${k}`).toBe(true);
        expect(en.has(k), `en thiếu ${k}`).toBe(true);
      }
    }
  });

  it("AC2: 22 key chết không còn trong vi/en", () => {
    const viFlat = flattenKeys(viDict);
    const enFlat = flattenKeys(enDict);
    const aliveVi = DEAD_KEYS.filter((k) => viFlat.has(k));
    const aliveEn = DEAD_KEYS.filter((k) => enFlat.has(k));
    expect(aliveVi, `còn sống trong vi: ${aliveVi.slice(0, 5).join(",")}`).toEqual([]);
    expect(aliveEn, `còn sống trong en: ${aliveEn.slice(0, 5).join(",")}`).toEqual([]);
  });

  it("AC3: 0 occurrence t(...) || literal trong 9 file AI CC", () => {
    const bad: string[] = [];
    for (const f of SRC9) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      // \bt( nhưng không phải đuôi của identifier khác (set(/get(/Result()
      const hits = src.split("\n").filter((ln) => /(?<![A-Za-z0-9_$])t\([^;\n]*\)\s*\|\|/.test(ln));
      for (const h of hits) bad.push(`${f}: ${h.trim().slice(0, 80)}`);
    }
    expect(bad, bad.slice(0, 5).join("\n")).toEqual([]);
  });

  it("AC5: 0 ký tự Việt cứng trong 9 file AI CC (EN render sạch)", () => {
    const bad: string[] = [];
    for (const f of SRC9) {
      let src = readFileSync(resolve(process.cwd(), f), "utf8");
      // loại comment (// và /* */) — contract chỉ soi chuỗi chạy thật
      src = src.replace(/\/\*[\s\S]*?\*\//g, "");
      src = src.split("\n").map((ln) => ln.replace(/\/\/.*$/, "")).join("\n");
      src.split("\n").forEach((ln, i) => {
        if (/[À-ɟ]/.test(ln)) bad.push(`${f}:${i + 1}: ${ln.trim().slice(0, 60)}`);
      });
    }
    expect(bad, bad.slice(0, 5).join("\n")).toEqual([]);
  });

  it("AC6: parity promptConfig vi/en", () => {
    const vi = nsKeys(viDict, "promptConfig");
    const en = nsKeys(enDict, "promptConfig");
    expect(vi.size).toBeGreaterThan(0);
    expect(en.size).toBeGreaterThan(0);
    expect([...vi].filter((k) => !en.has(k))).toEqual([]);
    expect([...en].filter((k) => !vi.has(k))).toEqual([]);
  });

  it("AC7: preset labels từ promptConfig.presets.*, không từ aiCommandCenter.preset*", () => {
    const drawer = readFileSync(
      resolve(process.cwd(), "src/components/AIAdvisoryPromptConfigDrawer.js"),
      "utf8"
    );
    expect(drawer.includes("promptConfig.presets.")).toBe(true);
    expect(drawer.includes("aiCommandCenter.preset")).toBe(false);
  });
});
