import { render, screen, fireEvent, act } from "@testing-library/react";
import { createElement } from "react";
import { AIAdvisoryPromptConfigDrawer } from "./AIAdvisoryPromptConfigDrawer";
import * as LangContext from "../context/LangContext.js";

const i18nValue = {
  locale: "vi",
  localeTag: "vi-VN",
  t: (key) => key,
  formatNumber: (n) => n,
  formatCurrency: (n) => n,
  formatPriceVND: (n) => n,
  formatQuotePrice: (p) => p,
  formatQuoteVolume: (v) => v,
  formatQuoteInteger: (v) => v,
  formatDate: (d) => d,
  formatTime: (t) => t,
  formatDateTime: (dt) => dt,
};

beforeEach(() => {
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AIAdvisoryPromptConfigDrawer", () => {
  it("renders nothing when closed (Slice 4)", () => {
    const { container } = render(
      createElement(AIAdvisoryPromptConfigDrawer, {
        isOpen: false,
        onClose: () => {},
        config: {},
        onConfigChange: () => {},
      })
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the prompt config title when open (Slice 6)", () => {
    render(
      createElement(AIAdvisoryPromptConfigDrawer, {
        isOpen: true,
        onClose: () => {},
        config: {},
        onConfigChange: () => {},
      })
    );
    expect(screen.getByText("promptConfig.title")).toBeTruthy();
  });

  it("calls onConfigChange when a technical preset is clicked (Slice 4)", () => {
    const onConfigChange = vi.fn();
    render(
      createElement(AIAdvisoryPromptConfigDrawer, {
        isOpen: true,
        onClose: () => {},
        config: {},
        onConfigChange,
      })
    );
    fireEvent.click(screen.getByText("promptConfig.enableAll"));
    expect(onConfigChange).toHaveBeenCalled();
  });
});
