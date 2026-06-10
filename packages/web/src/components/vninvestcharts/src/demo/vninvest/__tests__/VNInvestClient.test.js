/**
 * INT-04 — Unit tests for VNInvestClient
 * Tests via the vninvest/VNInvestClient re-export path.
 * 7 cases matching TASKBOARD INT-04 specification.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VNInvestClient } from "../VNInvestClient";
describe("VNInvestClient (INT-04)", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", {
            getItem: vi.fn().mockReturnValue(null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        });
    });
    afterEach(() => {
        VNInvestClient.__resetBarsHotWindowCacheForTests();
        vi.unstubAllGlobals();
    });
    it("setPAT thành công → PAT được lưu localStorage → hasPAT() = true", () => {
        const setItem = vi.fn();
        vi.stubGlobal("localStorage", {
            getItem: vi.fn().mockReturnValue(null),
            setItem,
            removeItem: vi.fn(),
        });
        const client = new VNInvestClient();
        client.setPAT("test-pat-token");
        expect(client.hasPAT()).toBe(true);
        expect(setItem).toHaveBeenCalledWith(expect.any(String), "test-pat-token");
    });
    it("getChart 401 → throw TOKEN_EXPIRED", async () => {
        const client = new VNInvestClient();
        client.setPAT("test-token");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, ok: false }));
        await expect(client.getChart("VCB")).rejects.toThrow("TOKEN_EXPIRED");
    });
    it("getChart 200 → trả đúng RawOHLCVBar[] shape", async () => {
        const client = new VNInvestClient();
        client.setPAT("test-token");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            status: 200,
            ok: true,
            json: vi.fn().mockResolvedValue({
                points: [{ date: "2026-01-01", open: 100, high: 110, low: 90, close: 105, volume: 1000 }],
            }),
        }));
        const bars = await client.getChart("VCB");
        expect(bars).toHaveLength(1);
        expect(bars[0].date).toBeInstanceOf(Date);
        expect(bars[0].close).toBe(105);
    });
    it("getChart 404 → throw SYMBOL_NOT_FOUND", async () => {
        const client = new VNInvestClient();
        client.setPAT("test-token");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));
        await expect(client.getChart("INVALID")).rejects.toThrow("SYMBOL_NOT_FOUND");
    });
    it("hasPAT() = false khi localStorage rỗng và chưa setPAT", () => {
        const client = new VNInvestClient();
        expect(client.hasPAT()).toBe(false);
    });
    it("hasPAT() = true sau setPAT với token hợp lệ", () => {
        const client = new VNInvestClient();
        client.setPAT("valid-token-123");
        expect(client.hasPAT()).toBe(true);
    });
    it("setPAT với whitespace-only → clearPAT → hasPAT() = false", () => {
        const client = new VNInvestClient();
        client.setPAT("existing-token");
        expect(client.hasPAT()).toBe(true);
        client.setPAT("   ");
        expect(client.hasPAT()).toBe(false);
    });
});
