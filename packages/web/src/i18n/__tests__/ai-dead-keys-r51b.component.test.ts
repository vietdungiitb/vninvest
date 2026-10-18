import { describe, it, expect } from "vitest";
import vi from "../vi.js";
import en from "../en.js";

// R5.1b — tra `AgentRegistry` (phuong an B) thi khoa i18n cua trang Agents
// thanh `dead key`. KHONG con call site san pham nao dung (grep 0-hit).
// Test nay khoa trang thai "da don" cho ca 2 locale + 2 nhan trang.
//
// Nguyen tac: khoa ca **mat** (khong con key) LAN **khong xoa qua rong** —
// 3 key anh vien phai con nguyen, neu xoa nham se lam mat nhan cua trang khac.
function getPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined,
      obj,
    );
}

const DEAD_PATHS = [
  "aiAgentFederation", // namespace 36 khoa, ca 2 file
  "agentFederation", // namespace trung ten 24 khoa — 0 call site toan repo
  "layout.nav.aiAgentFederation", // nhan trang trong sidebar
  "routes.aiAgentFederation", // nhan trang trong breadcrumb
  "aiCommandCenter.tabAgents", // R5.1 xoa tab nhung bo sot key
];

// Key anh vien: nam ngay canh trong ca 2 file, xoa nham se lam mat nhan cua trang khac.
// DUONG DAN DO DUOC bang `walk()` tren object that (lan 1 toi doan `layout.*` va
// `routes.aiTraces` — hai duong dan do KHONG ton tai; xem ledger Entry 376).
const SIBLING_KEYS = [
  "layout.nav.aiCommandCenter",
  "layout.nav.aiUsageAnalytics",
  "layout.nav.aiTraces",
  "layout.nav.aiSlo",
  "routes.aiCommandCenter",
  "routes.aiUsageAnalytics",
  "aiCommandCenter.tabOverview",
  "aiCommandCenter.tabUsage",
  "aiCommandCenter.tabTraces",
  "aiCommandCenter.tabSlo",
  "aiCommandCenter.tabAudit",
  "aiUsageAnalytics.showing",
];

const LOCALES = [
  ["vi", vi],
  ["en", en],
] as const;

describe("R5.1b — don khoa i18n chet cua trang Agents", () => {
  for (const [name, dict] of LOCALES) {
    it(`${name}: 3 duong dan cua trang Agents da bi xoa`, () => {
      const alive = DEAD_PATHS.filter((p) => getPath(dict, p) !== undefined);
      expect(alive, `con sot duong dan chet: ${alive.join(", ")}`).toEqual([]);
    });

    it(`${name}: key anh vien con nguyen (khong xoa qua rong)`, () => {
      const missing = SIBLING_KEYS.filter((p) => getPath(dict, p) === undefined);
      expect(missing, `xoa nham key khac: ${missing.join(", ")}`).toEqual([]);
    });
  }

  it("layout.nav: 2 locale cung TAP KEY (parity) va van dich khac nhau", () => {
    const viNav = Object.keys(getPath(vi, "layout.nav") as Record<string, string>);
    const enNav = Object.keys(getPath(en, "layout.nav") as Record<string, string>);
    expect(viNav.filter((k) => !enNav.includes(k)), "chi co o vi").toEqual([]);
    expect(enNav.filter((k) => !viNav.includes(k)), "chi co o en").toEqual([]);
    // 2 locale PHAI dich khac nhau — bang nhau nghia la 1 locale chua dich.
    expect(getPath(vi, "layout.nav.aiCommandCenter")).not.toBe(
      getPath(en, "layout.nav.aiCommandCenter"),
    );
  });

  it("routes: 2 locale cung TAP KEY (parity)", () => {
    const viR = Object.keys(getPath(vi, "routes") as Record<string, string>);
    const enR = Object.keys(getPath(en, "routes") as Record<string, string>);
    expect(viR.filter((k) => !enR.includes(k)), "chi co o vi").toEqual([]);
    expect(enR.filter((k) => !viR.includes(k)), "chi co o en").toEqual([]);
  });
});