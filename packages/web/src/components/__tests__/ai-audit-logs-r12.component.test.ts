/**
 * R1.2 — AIAuditLogsPanel: token + a11y + CSV + debounce + bỏ _r + date guard.
 * Fail-before: AC1/AC3/AC4/AC5/AC6/AC8 RED (không tồn tại / còn Tailwind cứng);
 * AC2 RED (header là div, không có button); AC7 GREEN sẵn (R0.9 đã dùng t(loadError)).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const adapterMocks = vi.hoisted(() => ({ getAIAuditLogs: vi.fn() }));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: { getAIAuditLogs: adapterMocks.getAIAuditLogs },
}));

vi.mock("../../context/LangContext.js", () => ({
  useI18n: () => ({ localeTag: "vi-VN", t: (k: string) => k }),
}));

import { AIAuditLogsPanel, buildAiAuditCsv, formatAuditDate } from "../AIAuditLogsPanel.js";

const PANEL = resolve(process.cwd(), "src/components/AIAuditLogsPanel.tsx");
const CSS = resolve(process.cwd(), "src/components/aiSettings.module.css");

const LOGS = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  action: i % 2 === 0 ? "update_settings" : "test_connection_failed",
  actor: `USER-${String(i).padStart(2, "0")}`,
  reason: i === 0 ? "manual check" : "",
  before_json: { a: 1 },
  after_json: { a: 2 },
  diff_summary: `change ${i}`,
  created_at: "2026-10-10T00:00:00Z",
}));

function mockPaged() {
  adapterMocks.getAIAuditLogs.mockImplementation(
    ({ offset = 0, limit = 10 }: { offset: number; limit: number }) =>
      Promise.resolve({ results: LOGS.slice(offset, offset + limit), total: LOGS.length })
  );
}

function renderPanel() {
  return render(
    createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(AIAuditLogsPanel, {}))
  );
}

describe("R1.2: AuditLogsPanel token + a11y + CSV", () => {
  beforeEach(() => {
    adapterMocks.getAIAuditLogs.mockReset();
    mockPaged();
  });

  it("AC1: 0 class Tailwind cứng trong panel", () => {
    const src = readFileSync(PANEL, "utf8");
    const hits = src
      .split("\n")
      .filter((ln) =>
        /bg-slate-|text-cyan-|text-\[|border-slate-|bg-slate-950|text-slate-|border-cyan-|bg-cyan-|text-rose-|border-rose-|bg-rose-|text-emerald-|border-emerald-|cursor-pointer|hover:/.test(
          ln
        )
      );
    expect(hits, hits.slice(0, 3).join("\n")).toEqual([]);
  });

  it("AC2: header là <button aria-expanded>, Enter/Space đóng mở được", async () => {
    const user = userEvent.setup();
    renderPanel();
    const collapsed = await screen.findAllByRole("button", { expanded: false });
    expect(collapsed.length).toBeGreaterThan(0);
    const btn = collapsed[0];
    expect(btn.tagName).toBe("BUTTON");
    await user.click(btn);
    await waitFor(() => expect(screen.getAllByRole("button", { expanded: true }).length).toBe(1));
    const open = screen.getAllByRole("button", { expanded: true })[0] as HTMLElement;
    open.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getAllByRole("button", { expanded: false }).length).toBeGreaterThan(0));
  });

  it("AC3: đổi filter 1 lần sau 300ms chỉ 1 request (debounce)", async () => {
    vi.useFakeTimers();
    try {
      renderPanel();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const callsAfterMount = adapterMocks.getAIAuditLogs.mock.calls.length;
      expect(callsAfterMount).toBe(1);
      adapterMocks.getAIAuditLogs.mockClear();
      const select = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "update_settings" } });
      // debounce: chưa gọi ngay
      expect(adapterMocks.getAIAuditLogs.mock.calls.length).toBe(0);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(adapterMocks.getAIAuditLogs.mock.calls.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("AC4: CSV có BOM/header/escape/cap 5000/cờ truncated", () => {
    const tricky = [
      {
        id: 1,
        action: "update_settings",
        actor: 'a"dmin, x',
        reason: "r",
        before_json: {},
        after_json: {},
        diff_summary: "",
        created_at: "2026-10-10T00:00:00Z",
      },
    ];
    const out = buildAiAuditCsv(tricky as never[]);
    expect(out.header).toContain("action");
    expect(out.body).toContain('"a""dmin, x"');
    expect(out.truncated).toBe(false);
    const many = Array.from({ length: 5005 }, (_, i) => ({ ...(tricky[0] as object), id: i }));
    const capped = buildAiAuditCsv(many as never[]);
    expect(capped.count).toBe(5000);
    expect(capped.truncated).toBe(true);
  });

  it("AC5: không còn request mang param _r", async () => {
    const src = readFileSync(PANEL, "utf8");
    expect(src.includes("params._r"), "source còn _r").toBe(false);
    renderPanel();
    await screen.findAllByRole("button", { expanded: false });
    const last = adapterMocks.getAIAuditLogs.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect("_r" in last, "_r vẫn gửi").toBe(false);
  });

  it("AC6: class .audit* chỉ dùng token --ai-* (không hex cứng)", () => {
    const css = readFileSync(CSS, "utf8");
    const start = css.indexOf("/* R1.2 audit");
    expect(start, "thiếu block R1.2 audit").toBeGreaterThan(-1);
    const end = css.indexOf("/* /R1.2 */", start);
    expect(end, "thiếu đóng block audit").toBeGreaterThan(start);
    const block = css.slice(start, end);
    expect(/#[0-9a-fA-F]{3,8}\b/.test(block), "hex cứng trong audit css").toBe(false);
    expect(block.includes("var(--ai-")).toBe(true);
  });

  it("AC7: lỗi tải hiện t(aiCommandCenter.loadError), không phải raw message", async () => {
    // lỗi không có message (rớt mạng) ⇒ phải hiện chuỗi dịch, không phải key thô/message lạ
    adapterMocks.getAIAuditLogs.mockRejectedValueOnce(new Error());
    renderPanel();
    const err = await screen.findByText("aiCommandCenter.loadError");
    expect(err.textContent).not.toContain("boom-500");
  });

  it("AC8: formatDate guard ngày hỏng → —", () => {
    expect(formatAuditDate("not-a-date", "vi-VN")).toBe("—");
    expect(formatAuditDate("", "vi-VN")).toBe("—");
    expect(formatAuditDate("2026-10-10T00:00:00Z", "vi-VN")).toContain("2026");
  });
});
