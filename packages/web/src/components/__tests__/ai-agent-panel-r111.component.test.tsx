/**
 * R1.11 FE — agent panel: nhãn Lưu, notice, defaults.
 * Fail-before trên panel cũ:
 * AC1 RED (nút hiện "loading" khi saving), AC2 RED (không tự tắt/không nút
 * đóng), AC4 RED (default provider openai cứng). AC3 ở capabilities.test.
 * AC5 = eslint gate. Phản biện agentTypes.*: GIỮ type* đã ship ở R1.3.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { AIAgentFederationPanel } from "../AIAgentFederationPanel";
import * as LangContext from "../../context/LangContext.js";
import { PROVIDER_OPTIONS, PROVIDER_MODELS } from "../../shared/providerModels.js";

vi.mock("../../context/LangContext.js", () => ({
  useI18n: () => ({
    locale: "vi",
    localeTag: "vi-VN",
    t: (k: string) => k,
    formatNumber: (n: unknown) => String(n ?? ""),
  }),
}));

vi.mock("../ConfirmModal.js", () => ({
  ConfirmProvider: ({ children }: { children: unknown }) => children,
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

const agentMocks = vi.hoisted(() => ({
  getAIAgents: vi.fn(),
  createAIAgent: vi.fn(),
  updateAIAgent: vi.fn(),
  deleteAIAgent: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    get getAIAgents() {
      return agentMocks.getAIAgents;
    },
    get createAIAgent() {
      return agentMocks.createAIAgent;
    },
    get updateAIAgent() {
      return agentMocks.updateAIAgent;
    },
    get deleteAIAgent() {
      return agentMocks.deleteAIAgent;
    },
  },
}));

function renderPanel() {
  return render(
    createElement(MemoryRouter, null, createElement(AIAgentFederationPanel, {}))
  );
}

describe("R1.11 FE: agent panel", () => {
  beforeEach(() => {
    for (const fn of Object.values(agentMocks)) (fn as ReturnType<typeof vi.fn>).mockReset();
    agentMocks.getAIAgents.mockResolvedValue({ results: [] });
    agentMocks.createAIAgent.mockImplementation(async (d: Record<string, unknown>) => ({ id: 1, ...d }));
    vi.spyOn(LangContext, "useI18n").mockReturnValue({
      locale: "vi",
      localeTag: "vi-VN",
      t: (k: string) => k,
      formatNumber: (n: unknown) => String(n ?? ""),
    } as never);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function openForm() {
    renderPanel();
    const addBtn = await screen.findByText("aiAgentFederation.addAgent");
    await act(async () => {
      fireEvent.click(addBtn);
    });
  }

  async function fillName(name: string) {
    const nameInput = await screen.findByPlaceholderText("aiAgentFederation.placeholderName");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: name } });
    });
  }

  it("AC1: bấm Lưu → nhãn nút Đang lưu (không phải Đang tải)", async () => {
    let release!: (v: unknown) => void;
    agentMocks.createAIAgent.mockImplementationOnce(
      () => new Promise((res) => { release = res as (v: unknown) => void; })
    );
    await openForm();
    await fillName("Sector Analyst");
    const saveBtn = screen.getByRole("button", { name: "aiAgentFederation.save" });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(screen.getByRole("button", { name: "aiAgentFederation.saving" })).toBeTruthy();
    await act(async () => {
      release({ id: 1 });
    });
  });

  it("AC2: notice role=status, tự tắt sau 4s, có nút đóng", async () => {
    await openForm();
    await fillName("Sector Analyst");
    const saveBtn = screen.getByRole("button", { name: "aiAgentFederation.save" });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    const notice = await screen.findByRole("status");
    expect(notice.textContent).toContain("aiAgentFederation.created");
    const closeBtn = screen.getByRole("button", { name: "aiAgentFederation.dismissNotice" });
    await act(async () => {
      fireEvent.click(closeBtn);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("AC2b: notice tự tắt sau 4s (đợi thật 4.1s — timer đã đặt bằng clock thật)", async () => {
    await openForm();
    await fillName("Sector Analyst");
    const saveBtn = screen.getByRole("button", { name: "aiAgentFederation.save" });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    await screen.findByRole("status");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 4100));
    });
    expect(screen.queryByRole("status")).toBeNull();
  }, 20000);

  it("AC4: default form từ PROVIDER_MODELS (không hardcode openai)", async () => {
    await openForm();
    const expectedProvider = PROVIDER_OPTIONS[0].key;
    const expectedModel = (PROVIDER_MODELS[expectedProvider] || [])[0]?.key ?? "";
    const selects = document.querySelectorAll("select");
    // thứ tự: agent_type, provider, model
    const providerSel = selects[1] as HTMLSelectElement;
    const modelSel = selects[2] as HTMLSelectElement;
    expect(providerSel.value).toBe(expectedProvider);
    expect(modelSel.value).toBe(expectedModel);
  });
});
