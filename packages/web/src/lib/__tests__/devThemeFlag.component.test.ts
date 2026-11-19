import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyDevThemeFlag, isDevThemeFlagActive } from "../devThemeFlag.js";

describe("W0/D5 dev-only light flag", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    history.replaceState({}, "", "/");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dev/staging build + ?theme=light ⇒ bật light", () => {
    vi.stubEnv("VITE_DEV_THEME_FLAG", "1");
    history.replaceState({}, "", "/?theme=light");
    expect(isDevThemeFlagActive()).toBe(true);
    expect(applyDevThemeFlag()).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("vninvest-theme")).toBe("light");
  });

  it("có env flag nhưng KHÔNG có query ⇒ giữ dark", () => {
    vi.stubEnv("VITE_DEV_THEME_FLAG", "1");
    history.replaceState({}, "", "/");
    expect(applyDevThemeFlag()).toBe(false);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("có ?theme=light nhưng build production (không env) ⇒ KHÔNG bật", () => {
    history.replaceState({}, "", "/?theme=light");
    expect(isDevThemeFlagActive()).toBe(false);
    expect(applyDevThemeFlag()).toBe(false);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
