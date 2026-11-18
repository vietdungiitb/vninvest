import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isSystemMarketGroup } from "../../constants/marketGroups";
import { filterUserWatchlistGroups } from "../../features/dashboard/useCoreDashboardData.js";

describe("Heatmap scope — chỉ mã user theo dõi, không lấy nhóm thị trường", () => {
  const systemTypes = ["SECTOR", "INDEX", "EXCHANGE", "ETF", "CW", "BOND", "DERIVATIVE", "MARKET_CAP"];

  it("mọi group_type hệ thống đều bị loại (kể cả tên không có trong SYSTEM_GROUP_IDS)", () => {
    const names = ["Thép & Vật liệu", "VNX50", "HNXCon", "FU_INDEX", "Bán lẻ & Tiêu dùng"];
    for (const type of systemTypes) {
      for (const name of names) {
        expect(isSystemMarketGroup({ group_type: type, name })).toBe(true);
      }
    }
  });

  it("group CUSTOM / tên user được giữ", () => {
    expect(isSystemMarketGroup({ group_type: "CUSTOM", name: "Theo dõi riêng" })).toBe(false);
    expect(isSystemMarketGroup({ name: "Theo dõi riêng" })).toBe(false);
  });

  it("fallback slug bỏ dấu khi thiếu group_type", () => {
    expect(isSystemMarketGroup({ name: "Ngân hàng" })).toBe(true);
    expect(isSystemMarketGroup({ name: "Thép & Vật liệu" })).toBe(true);
    expect(isSystemMarketGroup({ id: "vn30" })).toBe(true);
  });

  it("hành vi: filterUserWatchlistGroups chỉ trả group user", () => {
    const groups = [
      { id: 7, name: "Ngân hàng", group_type: "SECTOR", items: [{ symbol: "VCB" }] },
      { id: 8, name: "VNX50", group_type: "INDEX", items: [{ symbol: "FPT" }] },
      { id: 99, name: "Theo dõi riêng", group_type: "CUSTOM", items: [{ symbol: "ACB" }] },
    ];
    const out = filterUserWatchlistGroups(groups);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(99);
    expect(out[0].items[0].symbol).toBe("ACB");
  });

  it("hook dùng helper trước khi setState", () => {
    const src = readFileSync(resolve(process.cwd(), "src/features/dashboard/useCoreDashboardData.js"), "utf8");
    expect(src).toContain("filterUserWatchlistGroups");
    const i = src.indexOf("const watchlistGroups =");
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, i + 160)).toContain("filterUserWatchlistGroups(rawWatchlistGroups)");
  });
});
