import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsProvider, useSettings } from "../../context/SettingsProvider.js";
import { ALL_COMMANDS, GLOBAL_COMMANDS, TENANT_ADMIN_COMMANDS } from "../CommandRegistry.js";

function DensityProbe() {
  const { density, setDensity } = useSettings();
  return (
    <button data-testid="density" data-density={density} onClick={() => setDensity("compact")}>
      {density}
    </button>
  );
}

describe("W3 command palette + density", () => {
  it("palette mount DUY NHẤT ở FullLayout", async () => {
    const fs = await import("node:fs");
    const full = fs.readFileSync("src/layouts/full/FullLayout.tsx", "utf8");
    const tenant = fs.readFileSync("src/components/TenantAdminLayout.tsx", "utf8");
    expect((full.match(/e\(AppCommandPalette\)/g) || []).length).toBe(1);
    expect(tenant).not.toMatch(/<TenantAdminCommandPalette\s*\/>/);
    expect(tenant).not.toMatch(/AppCommandPalette/);
  });

  it("registry có global + 15 tenant, không hardcode ở palette", () => {
    expect(GLOBAL_COMMANDS.length).toBeGreaterThanOrEqual(4);
    expect(TENANT_ADMIN_COMMANDS.length).toBe(15);
    expect(ALL_COMMANDS).toHaveLength(GLOBAL_COMMANDS.length + TENANT_ADMIN_COMMANDS.length);
    expect(TENANT_ADMIN_COMMANDS.every((c) => !c.subject || typeof c.subject === "string")).toBe(true);
  });

  it("SettingsProvider đổi data-density và giữ state", () => {
    document.documentElement.removeAttribute("data-density");
    render(<SettingsProvider><DensityProbe /></SettingsProvider>);
    expect(screen.getByTestId("density").getAttribute("data-density")).toBe("comfortable");
    act(() => screen.getByTestId("density").click());
    expect(screen.getByTestId("density").getAttribute("data-density")).toBe("compact");
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
  });
});
