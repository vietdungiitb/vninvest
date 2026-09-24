import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import * as LangContext from "../../context/LangContext.js";
import * as PortfolioContext from "../../context/PortfolioContext.js";
import { AdminAuditPage } from "./AdminAuditPage";

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocAuditEvents: vi.fn(),
  },
}));

import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

const i18nValue = {
  locale: "vi",
  t: (key: string) => key,
};

function renderPage(staff: boolean) {
  vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({
    userIdentity: { isStaff: staff, isSuperuser: false },
  } as never);
  return render(
    createElement(MemoryRouter, null, createElement(AdminAuditPage)),
  );
}

beforeEach(() => {
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue as never);
  (defaultCoreApiAdapter.getSocAuditEvents as ReturnType<typeof vi.fn>).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminAuditPage (R4 tenant-admin-refactor)", () => {
  it("renders rows with filters for staff", async () => {
    (defaultCoreApiAdapter.getSocAuditEvents as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1, next: null, previous: null,
      results: [{ event_id: "e1", actor_label: "staff", tenant_id: "t-uuid-1",
        action: "update", resource_type: "core_user", resource_id: "9",
        occurred_at: "2026-09-23T00:00:00Z" }],
    });
    renderPage(true);
    await waitFor(() => {
      expect(screen.getByText("staff")).toBeTruthy();
    });
    expect(screen.getByText("adminAudit.pageOf")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("adminAudit.filterActor"), {
      target: { value: "staff" },
    });
    fireEvent.click(screen.getByText("adminAudit.apply"));
    await waitFor(() => {
      expect(defaultCoreApiAdapter.getSocAuditEvents).toHaveBeenCalledWith(
        expect.objectContaining({ actor: "staff" }),
      );
    });
  });

  it("shows noPermission and skips fetch for non-staff", async () => {
    renderPage(false);
    await waitFor(() => {
      expect(screen.getByText("common.noPermission")).toBeTruthy();
    });
    expect(defaultCoreApiAdapter.getSocAuditEvents).not.toHaveBeenCalled();
  });
});
