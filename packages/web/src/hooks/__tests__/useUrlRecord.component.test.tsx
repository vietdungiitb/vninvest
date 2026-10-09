/**
 * WAVE 4 / S4 — `useUrlRecord` + Major 2 (`replace`).
 *
 * Vì sao `useUrlRecord` tồn tại: 4 trang admin có **một object phẳng 5–7 field**
 * được Apply chung bằng `setFilters({ ...filtersDraft })`. `useUrlState` ghi
 * **từng tham số** ⇒ 1 lần bấm Apply tạo 5–7 history entry. `useUrlRecord` ghi
 * **một** `setParams` cho cả bản ghi.
 *
 * ⚠ Quan sát `replace` bằng **spy lên `setParams`**, KHÔNG đòi lịch sử trình
 * duyệt: `RouterState` (`router.d.ts:200-256`) **không** expose chỉ số history,
 * và `@remix-run/router` không phải dependency trực tiếp của `packages/web`.
 * Đo bằng `router.state.historyAction` chỉ cho biết lần ghi **cuối** là push hay
 * replace — **không** cho biết có bao nhiêu entry, nên không đủ để chứng minh
 * "1 ký tự = 1 entry" đã hết.
 */

import { describe, expect, test, afterEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import {
  useUrlRecord, useUrlState, useUrlValue, intCodec, stringCodec, boolCodec,
} from "../useUrlState";

afterEach(cleanup);
vi.restoreAllMocks();

// ── Bộ đo dùng chung ───────────────────────────────────────────────────────
let setRecord: (v: unknown) => void = () => {};
let seenUrl = "";
/** Tham chiếu của `value` ở mỗi lần render — dùng cho AC identity. */
let valueRefs: unknown[] = [];

/** Ép render lại chính component con (không dựa vào `rerender` của router). */
let bump: () => void = () => {};
function useProbeRender() {
  const [, setN] = useState(0);
  bump = () => setN((n) => n + 1);
}

function ProbeRecord({ spec, defaults, prefix, options }: {
  spec: Parameters<typeof useUrlRecord>[0];
  defaults: Record<string, unknown>;
  prefix?: string;
  options?: Parameters<typeof useUrlRecord>[3];
}) {
  useProbeRender();
  const [rec, setRec] = useUrlRecord(
    spec, defaults, prefix ?? "",
    options as Parameters<typeof useUrlRecord>[3],
  );
  setRecord = setRec as (v: unknown) => void;
  valueRefs.push(rec);
  seenUrl = `${useLocation().pathname}${useLocation().search}`;
  return <pre data-testid="state">{JSON.stringify(rec)}</pre>;
}

function ProbeState({ spec, defaults, options }: {
  spec: Parameters<typeof useUrlState>[0];
  defaults: Record<string, unknown>;
  options?: Parameters<typeof useUrlState>[2];
}) {
  const [st, setSt] = useUrlState(spec, defaults, options as Parameters<typeof useUrlState>[2]);
  setRecord = setSt as (v: unknown) => void;
  seenUrl = `${useLocation().pathname}${useLocation().search}`;
  return <pre data-testid="state">{JSON.stringify(st)}</pre>;
}

function ProbeValue({ k, codec, fallback, options }: {
  k: string; codec: unknown; fallback: unknown;
  options?: Parameters<typeof useUrlValue>[3];
}) {
  const [v, setV] = useUrlValue(k, codec as never, fallback as never, options as never);
  setRecord = setV as (v: unknown) => void;
  seenUrl = `${useLocation().pathname}${useLocation().search}`;
  return <pre data-testid="state">{String(v)}</pre>;
}

const state = () => document.querySelector("[data-testid=state]")?.textContent ?? "";

function mount(el: React.ReactElement, initial = "/admin/x") {
  valueRefs = [];
  const router = createMemoryRouter([{ path: "/admin/x", element: el }], { initialEntries: [initial] });
  const view = render(<RouterProvider router={router} />);
  return { router, rerender: view.rerender };
}

const SPEC = { search: stringCodec, status: stringCodec, kind: stringCodec };
const DEFAULTS = { search: "", status: "", kind: "" };

// ───────────────────────────────────────────────────────────────────────────
describe("useUrlRecord — doc ban ghi tu URL", () => {
  test("ban ghi 5–7 field render dung tu query string", () => {
    mount(<ProbeRecord spec={SPEC} defaults={DEFAULTS} />,
      "/admin/x?search=fpt&status=active&kind=run");
    expect(JSON.parse(state())).toEqual({ search: "fpt", status: "active", kind: "run" });
  });

  test("thieu tham so → fallback (khong undefined)", () => {
    mount(<ProbeRecord spec={SPEC} defaults={DEFAULTS} />, "/admin/x?search=fpt");
    expect(JSON.parse(state())).toEqual({ search: "fpt", status: "", kind: "" });
  });

  test("tien to: `audit_search` KHONG khai bao `search`", () => {
    mount(<ProbeRecord spec={SPEC} defaults={DEFAULTS} prefix="audit_" />,
      "/admin/x?audit_search=fpt&search=bỏ");
    expect(JSON.parse(state())).toEqual({ search: "fpt", status: "", kind: "" });
    expect(seenUrl).toContain("search=b");
  });
});

describe("useUrlRecord — ghi ban ghi vao URL", () => {
  test("Apply 1 lan ghi CA ban ghi vao URL", () => {
    mount(<ProbeRecord spec={SPEC} defaults={DEFAULTS} />);
    act(() => { setRecord({ search: "fpt", status: "active", kind: "run" }); });
    expect(seenUrl).toContain("search=fpt");
    expect(seenUrl).toContain("status=active");
    expect(seenUrl).toContain("kind=run");
  });

  test("Apply mot lan sau XOA duoc tham so cu da dat truoc do", () => {
    mount(<ProbeRecord spec={SPEC} defaults={DEFAULTS} />, "/admin/x?status=active&kind=run");
    act(() => { setRecord({ search: "fpt" }); });
    expect(seenUrl).toContain("search=fpt");
    expect(seenUrl).not.toContain("status=active");
    expect(seenUrl).not.toContain("kind=run");
  });

  test("gia tri rong → tham so bi XOA khoi URL (khong con `search=`) ", () => {
    mount(<ProbeRecord spec={SPEC} defaults={DEFAULTS} />, "/admin/x?search=fpt");
    act(() => { setRecord({ search: "" }); });
    expect(seenUrl).not.toContain("search=");
  });

  test("vong tron: giu URL lai → render lai → ban ghi khoi phuc dung", () => {
    mount(<ProbeRecord spec={SPEC} defaults={DEFAULTS} />);
    act(() => { setRecord({ search: "fpt", status: "active", kind: "" }); });
    cleanup();
    mount(<ProbeRecord spec={SPEC} defaults={DEFAULTS} />, seenUrl);
    expect(JSON.parse(state())).toEqual({ search: "fpt", status: "active", kind: "" });
  });
});

// ── AC-4.5 identity ────────────────────────────────────────────────────────
describe("useUrlRecord — identity (AC-2.3 wave 3: bug da xay ra 1 lan)", () => {
  test("nhieu render lien tiep cung URL → value LUON cung tham chieu", () => {
    const SPEC_CONST = { search: stringCodec, status: stringCodec, kind: stringCodec };
    const DEFAULTS_CONST = { search: "", status: "", kind: "" };
    mount(<ProbeRecord spec={SPEC_CONST} defaults={DEFAULTS_CONST} />,
      "/admin/x?search=fpt&status=active");
    // Ép 3 vòng render mà URL KHÔNG đổi — đây mới là tình huống mà
    // `spec`/`defaults` là object LITERAL trong thân component làm hỏng.
    act(() => { bump(); });
    act(() => { bump(); });
    act(() => { bump(); });
    expect(valueRefs.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < valueRefs.length; i += 1) {
      expect(valueRefs[i]).toBe(valueRefs[i - 1]);
    }
  });

  test("spec/defaults truyền LITERAL trong render → identity KHONG giữ (nguồn của AC-2.3)", () => {
    // Đây là hành vi SAI mà AC-2.3 wave 3 cấm: object literal trong thân
    // component đổi tham chiếu mỗi render ⇒ `useMemo` trong hook tính lại.
    // Test này **cố ý** khẳng định cái sai, để lần refactor sau không vô tình
    // "sửa" nó rồi mất dấu vết.
    function LiteralProbe() {
      useProbeRender();
      const [rec] = useUrlRecord({ search: stringCodec }, { search: "" });
      valueRefs.push(rec);
      return <pre data-testid="state">{JSON.stringify(rec)}</pre>;
    }
    mount(<LiteralProbe />);
    act(() => { bump(); });
    expect(valueRefs.length).toBeGreaterThanOrEqual(2);
    expect(valueRefs[valueRefs.length - 1]).not.toBe(valueRefs[0]);
  });
});

// ── Major 2: `replace` ─────────────────────────────────────────────────────
describe("Major 2 — replace vs push", () => {
  test("MAC DINH van la push (khong doi hanh vi call site cu)", () => {
    const { router } = mount(<ProbeRecord spec={SPEC} defaults={DEFAULTS} />);
    act(() => { setRecord({ search: "a" }); });
    expect(router.state.historyAction).toBe("PUSH");
  });

  test("`replaceKeys` chi ap dung cho key duoc liet ke", () => {
    const { router } = mount(
      <ProbeState spec={SPEC} defaults={DEFAULTS} options={{ replaceKeys: ["search"] }} />,
    );
    act(() => { setRecord({ search: "a" }); });
    expect(router.state.historyAction).toBe("REPLACE");
    act(() => { setRecord({ status: "active" }); });
    expect(router.state.historyAction).toBe("PUSH");
  });

  test("`replace: true` ap dung cho MOI key", () => {
    const { router } = mount(<ProbeRecord spec={SPEC} defaults={DEFAULTS} options={{ replace: true }} />);
    act(() => { setRecord({ search: "a", status: "b" }); });
    expect(router.state.historyAction).toBe("REPLACE");
  });

  test("`useUrlValue` nhan `replace` qua options", () => {
    const { router } = mount(
      <ProbeValue k="q" codec={stringCodec} fallback="" options={{ replace: true }} />,
    );
    act(() => { setRecord("fpt"); });
    expect(router.state.historyAction).toBe("REPLACE");
  });

  test("`useUrlValue` MAC DINH van push", () => {
    const { router } = mount(<ProbeValue k="q" codec={stringCodec} fallback="" />);
    act(() => { setRecord("fpt"); });
    expect(router.state.historyAction).toBe("PUSH");
  });

  test("patch nhieu key: chi `replace` khi patch CHI cham key duoc liet ke", () => {
    const { router } = mount(
      <ProbeState spec={SPEC} defaults={DEFAULTS} options={{ replaceKeys: ["search"] }} />,
    );
    // (a) patch CHỈ gồm `search` (ô nhập văn bản) ⇒ replace.
    act(() => { setRecord({ search: "fpt" }); });
    expect(seenUrl).toContain("search=fpt");
    expect(router.state.historyAction).toBe("REPLACE");

    // (b) patch gồm CẢ `search` (replace) và `status` (push) ⇒ push, vì
    // `setParams` chi nhan MOT co cho ca lan ghi (2 lan trong 1 tick KHONG compose).
    act(() => { setRecord({ search: "hdb", status: "active" }); });
    expect(seenUrl).toContain("search=hdb");
    expect(seenUrl).toContain("status=active");
    expect(router.state.historyAction).toBe("PUSH");
  });
});

describe("boolCodec — serialize nhan string (bug da tung xay ra)", () => {
  test("truyen STRING, khong truyen boolean", () => {
    mount(<ProbeValue k="sortDir" codec={boolCodec<"asc" | "desc">("desc", "asc")} fallback="desc" />,
      "/admin/x?sortDir=asc");
    expect(state()).toBe("asc");
    act(() => { setRecord("desc"); });
    expect(seenUrl).not.toContain("sortDir=");
  });

  test("number codec: so nguyen, khong phai chuoi", () => {
    mount(<ProbeRecord spec={{ page: intCodec }} defaults={{ page: 1 }} />, "/admin/x?page=7");
    expect(JSON.parse(state())).toEqual({ page: 7 });
  });
});