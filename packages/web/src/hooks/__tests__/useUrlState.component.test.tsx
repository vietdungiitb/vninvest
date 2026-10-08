/**
 * FU-05 — `useUrlState` / `useUrlValue`.
 *
 * AC-3 cua plan: **vong tron** state -> URL -> `quay lai` -> state khoi phuc.
 * Day la observable nguoi dung thay; chi assert "URL co param" la PROXY
 * (hazard 8) — gate do ma khong bat duoc loi back/forward.
 *
 * ⚠ Dùng `createMemoryRouter` chứ KHÔNG dùng `<MemoryRouter>`:
 * `MemoryRouter` có **history riêng trong bo nho**, KHONG phai
 * `window.history` ⇒ goi `window.history.back()` khong co tac dung gi.
 * `RouterProvider` + `router.navigate(-1)` moi la cach quay lai that.
 */

import { describe, expect, test, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import {
  useUrlState, useUrlValue, intCodec, stringCodec, boolCodec,
} from "../useUrlState";

afterEach(cleanup);

let setValue: (v: unknown) => void = () => {};
let seenUrl = "";

function Probe({ spec, defaults }: {
  spec: Parameters<typeof useUrlState>[0];
  defaults: Record<string, unknown>;
}) {
  const [state, setState] = useUrlState(spec, defaults);
  setValue = setState as (v: unknown) => void;
  const loc = useLocation();
  seenUrl = `${loc.pathname}${loc.search}`;
  return <pre data-testid="state">{JSON.stringify(state)}</pre>;
}

function ProbeSingle({ k, codec, fallback }: {
  k: string; codec: unknown; fallback: unknown;
}) {
  const [v, setV] = useUrlValue(k, codec as never, fallback as never);
  setValue = setV as (v: unknown) => void;
  const loc = useLocation();
  seenUrl = `${loc.pathname}${loc.search}`;
  return <pre data-testid="state">{String(v)}</pre>;
}

const state = () => document.querySelector("[data-testid=state]")?.textContent ?? "";

function mount(el: React.ReactElement, initial = "/admin/x?page=3") {
  const router = createMemoryRouter(
    [{ path: "/admin/x", element: el }],
    { initialEntries: [initial] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("useUrlState — doc state tu URL", () => {
  test("gia tri trong URL duoc doc vao state", () => {
    mount(<Probe spec={{ page: intCodec, search: stringCodec }} defaults={{ page: 1, search: "" }} />,
      "/admin/x?page=3&search=VFC");
    expect(JSON.parse(state())).toEqual({ page: 3, search: "VFC" });
  });

  test("thieu tham so -> dung fallback", () => {
    mount(<Probe spec={{ page: intCodec, search: stringCodec }} defaults={{ page: 1, search: "" }} />,
      "/admin/x");
    expect(JSON.parse(state())).toEqual({ page: 1, search: "" });
  });

  test("tham so hong (page=abc) -> fallback, khong NaN", () => {
    mount(<Probe spec={{ page: intCodec }} defaults={{ page: 1 }} />, "/admin/x?page=abc");
    expect(JSON.parse(state())).toEqual({ page: 1 });
  });
});

describe("useUrlState — ghi URL va QUAY LAI (AC-3)", () => {
  test("doi state -> URL doi -> router.navigate(-1) -> state khoi phuc", async () => {
    const router = mount(
      <Probe spec={{ page: intCodec }} defaults={{ page: 1 }} />,
      "/admin/x?page=3",
    );
    expect(JSON.parse(state())).toEqual({ page: 3 });

    await act(async () => { setValue({ page: 7 }); });
    expect(seenUrl).toContain("page=7");
    expect(JSON.parse(state())).toEqual({ page: 7 });

    await act(async () => { await router.navigate(-1); });
    expect(seenUrl).toContain("page=3");
    expect(JSON.parse(state())).toEqual({ page: 3 });
  });

  test("quay lai nhieu lan di theo lich su", async () => {
    const router = mount(
      <Probe spec={{ page: intCodec }} defaults={{ page: 1 }} />,
      "/admin/x?page=1",
    );
    await act(async () => { setValue({ page: 2 }); });
    await act(async () => { setValue({ page: 3 }); });
    expect(JSON.parse(state())).toEqual({ page: 3 });

    await act(async () => { await router.navigate(-1); });
    expect(JSON.parse(state())).toEqual({ page: 2 });
    await act(async () => { await router.navigate(-1); });
    expect(JSON.parse(state())).toEqual({ page: 1 });
  });

  test("gia tri rong -> go khoi URL (khong tao ?page=)", async () => {
    mount(<Probe spec={{ page: intCodec, search: stringCodec }} defaults={{ page: 1, search: "" }} />,
      "/admin/x?page=5&search=VFC");
    await act(async () => { setValue({ search: "" }); });
    expect(seenUrl).not.toContain("search=");
    expect(seenUrl).toContain("page=5");
  });

  test("boolCodec: gia tri mac dinh -> go khoi URL", async () => {
    mount(<ProbeSingle k="sortDir" codec={boolCodec("asc", "desc")} fallback="asc" />,
      "/admin/x?sortDir=desc");
    expect(state()).toBe("desc");
    await act(async () => { setValue("asc"); });
    expect(seenUrl).not.toContain("sortDir=");
    expect(state()).toBe("asc");
  });

  test("patch nhieu tham so trong 1 lan, khong lam mat tham so khac", async () => {
    mount(<Probe spec={{ page: intCodec, search: stringCodec }} defaults={{ page: 1, search: "" }} />,
      "/admin/x?page=2&search=VCI");
    await act(async () => { setValue({ page: 9, search: "HPG" }); });
    expect(seenUrl).toContain("page=9");
    expect(seenUrl).toContain("search=HPG");
  });
});

describe("boolCodec — mac dinh phai la fallback, KHONG phai gia tri 'a'", () => {
  test("tham so vang -> tra undefined de hook dung fallback", () => {
    // Loi thuc te: `parse(null)` tra thang `a` lam `sortDir` mac dinh
    // `"asc"` thay vi `"desc"` — bat duoc boi test sap xep cua
    // portfolio-pages.component.test.tsx ("expected SMALL to be BIG").
    expect(boolCodec("desc", "asc").parse(null)).toBeUndefined();
    expect(boolCodec("desc", "asc").parse("")).toBeUndefined();
    expect(boolCodec("desc", "asc").parse("garbage")).toBeUndefined();
  });

  test("gia tri khac mac dinh -> parse ve dung gia tri", () => {
    expect(boolCodec("desc", "asc").parse("asc")).toBe("asc");
  });

  test("gia tri mac dinh -> serialize tra undefined (khong ghi URL)", () => {
    expect(boolCodec("desc", "asc").serialize("desc")).toBeUndefined();
    expect(boolCodec("desc", "asc").serialize("asc")).toBe("asc");
  });

  test("fallback duoc ton khi URL rong (test cap do component)", async () => {
    mount(<ProbeSingle k="sortDir" codec={boolCodec("desc", "asc")} fallback="desc" />, "/admin/x");
    expect(state()).toBe("desc");
    await act(async () => { setValue("asc"); });
    expect(seenUrl).toContain("sortDir=asc");
    expect(state()).toBe("asc");
  });
});

describe("useUrlValue — bien don", () => {
  test("gia tri don doc/ghi nhu tren", async () => {
    mount(<ProbeSingle k="q" codec={stringCodec} fallback="" />, "/admin/x?q=VIC");
    expect(state()).toBe("VIC");
    await act(async () => { setValue("HPG"); });
    expect(seenUrl).toContain("q=HPG");
  });
});

// ── W3-2 (AC-2.3) — identity cua gia tri phai ON DINH giua cac render ────────
//
// Vì sao AC này tồn tại: `useUrlState.ts:117` khai `useMemo` phụ thuộc `spec`
// va `defaults`. Neu caller truyen OBJECT LITERAL trong render (kieu
// `{ page: intCodec, ... }`) thi `spec` doi identity moi lan render ⇒ `value`
// la object moi ⇒ moi thay doi khac cung gay render moi.
//
// Wave 2 DA DANH MOT LAN: bug `boolCodec` (xem
// `docs/TEST_REPORT_UIUX_WAVE2.md:76`). 11 file cua W3-2 deu khai
// `SPEC`/`DEFAULTS` o CAP MODULE de tranh dieu nay — test nay khoa lai
// chinh sach do, va bat nguoc lai neu ai trai ve literal trong render.
describe("W3-2 AC-2.3 · spec/defaults o cap module ⇒ gia tri ON DINH khi URL khong doi", () => {
  /**
   * Luu y khoa: chi so sanh cac render **cung mot `location.search`**.
   * Khi URL doi thi `params` doi ⇒ `useMemo` tinh lai ⇒ tra object moi la
   * DUNG. Bảo đảm chi có ý nghĩa khi người dùng chưa đổi URL.
   */
  test("spec + defaults khai o module: cung URL ⇒ cUNG mot object qua nhieu render", () => {
    const SPEC = { page: intCodec, search: stringCodec };
    const DEFAULTS = { page: 1, search: "" };
    const pairs: { search: string; state: unknown }[] = [];

    function Probe() {
      const loc = useLocation();
      const [state] = useUrlState(SPEC, DEFAULTS);
      pairs.push({ search: loc.search, state });
      return <pre data-testid="v">{JSON.stringify(state)}</pre>;
    }

    const router = createMemoryRouter([{ path: "/", element: <Probe /> }]);
    render(<RouterProvider router={router} />);
    act(() => { router.navigate("/?page=3&search=FPT"); });
    // render them voi **cung URL** (re-navigate ve cung dia chi)
    act(() => { router.navigate("/?page=3&search=FPT"); });
    act(() => { router.navigate("/?page=3&search=FPT"); });

    const bySearch = new Map<string, unknown[]>();
    for (const p of pairs) {
      if (!bySearch.has(p.search)) bySearch.set(p.search, []);
      bySearch.get(p.search)!.push(p.state);
    }
    // moi nhom theo URL phai CHI CO MOT identity
    expect(bySearch.size).toBeGreaterThan(0);
    for (const [search, states] of bySearch) {
      expect(states.length).toBeGreaterThanOrEqual(1);
      for (const s of states) expect(s).toBe(states[0]);
      void search;
    }
  });

  test("spec truyen LITERAL trong render: cung URL van ra object KHAC nhau (bat duoc)", () => {
    const DEFAULTS = { page: 1 };
    const pairs: { search: string; state: unknown }[] = [];

    function Probe() {
      const loc = useLocation();
      // COT Y giai thieu mau phai tranh - giu de test bat duoc khi ai viet lai.
      const [state] = useUrlState({ page: intCodec }, DEFAULTS);
      pairs.push({ search: loc.search, state });
      return <pre data-testid="v">{JSON.stringify(state)}</pre>;
    }

    const router = createMemoryRouter([{ path: "/", element: <Probe /> }]);
    render(<RouterProvider router={router} />);
    act(() => { router.navigate("/?page=5"); });
    act(() => { router.navigate("/?page=5"); });

    const same = pairs.filter((p) => p.search === "?page=5");
    expect(same.length).toBeGreaterThanOrEqual(2);
    expect(same[1].state).not.toBe(same[0].state);
  });
});