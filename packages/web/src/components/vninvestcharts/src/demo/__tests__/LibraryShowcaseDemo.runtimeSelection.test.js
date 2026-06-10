// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_DEMO_SETTINGS, DEMO_SETTINGS_STORAGE_KEY, loadDemoSettings, saveDemoSettings, } from "../demoSettings";
describe("demo runtime lane settings", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });
    it("defaults the CVD overlay to hidden", () => {
        expect(DEFAULT_DEMO_SETTINGS.enableCVD).toBe(false);
        expect(loadDemoSettings().enableCVD).toBe(false);
    });
    it("defaults the demo runtime lane to fork", () => {
        expect(DEFAULT_DEMO_SETTINGS.runtimeLane).toBe("fork");
        expect(loadDemoSettings().runtimeLane).toBe("fork");
    });
    it("persists and reloads a valid runtime lane", () => {
        saveDemoSettings({
            ...DEFAULT_DEMO_SETTINGS,
            runtimeLane: "fork",
        });
        const persisted = JSON.parse(window.localStorage.getItem(DEMO_SETTINGS_STORAGE_KEY) ?? "{}");
        expect(persisted.runtimeLane).toBe("fork");
        expect(loadDemoSettings().runtimeLane).toBe("fork");
    });
    it("falls back to fork when the stored runtime lane is invalid", () => {
        window.localStorage.setItem(DEMO_SETTINGS_STORAGE_KEY, JSON.stringify({ runtimeLane: "invalid" }));
        expect(loadDemoSettings().runtimeLane).toBe("fork");
    });
    it("migrates v2 auto runtime lane to fork by default", () => {
        window.localStorage.setItem("rsc-demo-settings-v2", JSON.stringify({ runtimeLane: "auto" }));
        expect(loadDemoSettings().runtimeLane).toBe("fork");
    });
    it("migrates legacy demo settings, snaps max bars to preset defaults, and disables surprise CVD overlays", () => {
        window.localStorage.setItem("rsc-demo-settings-v1", JSON.stringify({
            maxVisibleBars: 750,
            runtimeLane: "fork",
            enableCVD: true,
        }));
        const settings = loadDemoSettings();
        expect(settings.maxVisibleBars).toBe(20_000);
        expect(settings.runtimeLane).toBe("fork");
        expect(settings.enableCVD).toBe(false);
    });
});
