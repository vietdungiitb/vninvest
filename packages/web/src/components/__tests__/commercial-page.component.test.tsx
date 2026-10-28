import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CommercialPage } from "../commercial/CommercialPage.js";
import { LangProvider } from "../../context/LangContext.js";
import { PortfolioProvider } from "../../context/PortfolioContext.js";
import { CommercialToolbar } from "../commercial/primitives/CommercialToolbar.js";
import { CommercialState } from "../commercial/primitives/CommercialState.js";
import { CommercialTable } from "../commercial/primitives/CommercialTable.js";
import { CommercialMeta } from "../commercial/primitives/CommercialMeta.js";

const COMMERCIAL_DIR = resolve(process.cwd(), "src/components/commercial");
const CSS_PATH = resolve(COMMERCIAL_DIR, "CommercialPage.module.css");
const COMPONENT_FILES = [
  resolve(COMMERCIAL_DIR, "CommercialPage.tsx"),
  resolve(COMMERCIAL_DIR, "commercialMessages.ts"),
  resolve(COMMERCIAL_DIR, "primitives/CommercialToolbar.tsx"),
  resolve(COMMERCIAL_DIR, "primitives/CommercialState.tsx"),
  resolve(COMMERCIAL_DIR, "primitives/CommercialTable.tsx"),
  resolve(COMMERCIAL_DIR, "primitives/CommercialMeta.tsx"),
];

afterEach(() => {
  cleanup();
});

describe("UI Standardization W0 — CommercialPage contract (AC-3)", () => {
  it("AC-1: render đủ props ⇒ 1 h1, 1 region, 0 main, state zone có node, id do useId() sinh", () => {
    const { container } = render(
      <CommercialPage
        eyebrow="COMMERCIAL"
        title="Danh mục danh nợ"
        description="Mô tả ngắn về trang"
        badge={<span>VIP</span>}
        metrics={<div>metric-1</div>}
        notice="Thông báo thường"
        toolbar={<button type="button">Lọc</button>}
        actions={<button type="button">Lưu</button>}
        meta={<CommercialMeta items={[{ label: "Cập nhật lúc", value: "12:00" }]} />}
      >
        <div>Nội dung chính</div>
      </CommercialPage>,
    );

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll('[role="region"]')).toHaveLength(1);
    expect(container.querySelectorAll("main")).toHaveLength(0);
    expect(container.querySelectorAll("main main")).toHaveLength(0);

    const stateZone = container.querySelector('[data-cm-zone="state"]');
    expect(stateZone).not.toBeNull();

    const region = container.querySelector('[role="region"]');
    const h1 = container.querySelector("h1");
    expect(region?.getAttribute("aria-labelledby")).toBe(h1?.id);
    expect(region?.id).toBeTruthy();
    expect(region?.id.startsWith("cm-")).toBe(true);
    expect(h1?.id).toBe(`${region?.id}-title`);
  });

  it("AC-1b: id truyền vào được giữ, h1 id = ${id}-title", () => {
    const { container } = render(<CommercialPage id="commercial-orders" title="Lệnh" />);
    const region = container.querySelector('[role="region"]');
    const h1 = container.querySelector("h1");
    expect(region?.id).toBe("commercial-orders");
    expect(h1?.id).toBe("commercial-orders-title");
    expect(region?.getAttribute("aria-labelledby")).toBe("commercial-orders-title");
  });

  it("AC-1c: 6 vùng đều có mốc data-cm-zone (header/toolbar/body/state/actions/meta)", () => {
    const { container } = render(
      <CommercialPage
        title="Vùng"
        toolbar={<button type="button">Lọc</button>}
        actions={<button type="button">Lưu</button>}
        meta={<CommercialMeta items={[{ label: "Nguồn", value: "API" }]} />}
      >
        <div>Nội dung</div>
      </CommercialPage>,
    );
    for (const zone of ["header", "toolbar", "body", "state", "actions", "meta"]) {
      expect(container.querySelector(`[data-cm-zone="${zone}"]`)).not.toBeNull();
    }
  });

  it("AC-2: error khác rỗng ⇒ role=alert + nút Thử lại + text hướng khắc phục", () => {
    const onRetry = vi.fn();
    render(
      <PortfolioProvider>
        <LangProvider>
          <CommercialPage title="Lỗi" error="Không tải được dữ liệu." state={{ onRetry }} />
        </LangProvider>
      </PortfolioProvider>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Không tải được dữ liệu.");
    expect(alert.textContent).toContain("tải lại trang");

    const retry = screen.getByRole("button", { name: "Thử lại" });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("AC-2b: không có error ⇒ vẫn có node alert/live mount sẵn nhưng không có nút Thử lại", () => {
    render(<CommercialPage title="Rỗng" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
  });

  it("AC-3: loading ⇒ skeleton aria-hidden + vùng aria-busy (node khác vùng live)", () => {
    const { container } = render(<CommercialPage title="Đang tải" state={{ loading: true }} />);

    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();

    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute("aria-hidden")).toBe("true");

    const live = container.querySelector('[aria-live]');
    expect(live).not.toBeNull();
    expect(busy).not.toBe(live);
    expect(live?.contains(skeleton as Node)).toBe(true);
  });

  it("AC-3b: empty ⇒ hiện dấu placeholder, lý do và CTA", () => {
    const { container } = render(
      <CommercialPage
        title="Rỗng"
        state={{ empty: true, emptyReason: "Chưa có lệnh nào.", emptyCta: <button type="button">Tạo lệnh</button> }}
      />,
    );
    const live = container.querySelector('[aria-live]');
    expect(live?.textContent).toContain("—");
    expect(live?.textContent).toContain("Chưa có lệnh nào.");
    expect(screen.getByRole("button", { name: "Tạo lệnh" })).toBeTruthy();
  });

  it("AC-4: route đã có h1 riêng mà KHÔNG gỡ ⇒ ra 2 h1 (template không tự gỡ h1 của route)", () => {
    const { container } = render(
      <div>
        <h1>Tiêu đề legacy của route</h1>
        <CommercialPage title="Tiêu đề của template" />
      </div>,
    );
    expect(container.querySelectorAll("h1")).toHaveLength(2);
  });

  it("AC-4b: CommercialPage tự nó chỉ render đúng 1 h1", () => {
    const { container } = render(<CommercialPage title="Một" />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("AC-5: CSS mới không có hex cứng", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it("AC-5b: JSX mới không có hex cứng", () => {
    for (const file of COMPONENT_FILES) {
      const src = readFileSync(file, "utf8");
      expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    }
  });

  it("AC-5c: không focus:outline-none thiếu ring thay thế", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    expect(css).not.toMatch(/outline\s*:\s*none/i);
    expect(css).not.toMatch(/outline-none/i);
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/:focus-visible[^{]*\{[^}]*outline\s*:\s*2px/);
  });

  it("AC-5e: mọi class trong CSS module đều có tiền tố .cm-", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    const classNames = [...new Set([...css.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)].map((m) => m[1]))];
    expect(classNames.length).toBeGreaterThan(0);
    for (const name of classNames) {
      expect(name.startsWith("cm-")).toBe(true);
    }
  });

  it("AC-5f: mọi key styles[...] dùng trong JSX đều tồn tại trong CSS module (và ngược lại)", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    const cssClasses = new Set([...css.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)].map((m) => m[1]));

    const usedKeys = new Set<string>();
    for (const file of COMPONENT_FILES) {
      if (!file.endsWith(".tsx")) continue;
      const src = readFileSync(file, "utf8");
      for (const match of src.matchAll(/styles\["([^"]+)"\]/g)) {
        usedKeys.add(match[1]);
      }
    }

    expect(usedKeys.size).toBeGreaterThan(0);
    for (const key of usedKeys) {
      expect(cssClasses.has(key)).toBe(true);
    }
    for (const className of cssClasses) {
      expect(usedKeys.has(className)).toBe(true);
    }
  });

  it("AC-5d: file component không hardcode chuỗi hiển thị tiếng Việt", () => {
    const viRegex = /[\u00C0-\u1EF9]/;
    const componentOnly = COMPONENT_FILES.filter((f) => !f.endsWith("commercialMessages.ts"));
    for (const file of componentOnly) {
      const src = readFileSync(file, "utf8");
      expect(viRegex.test(src)).toBe(false);
    }
  });
});

describe("UI Standardization W0 — primitives (AC-3)", () => {
  it("CommercialTable: có caption + scope cho header và row header", () => {
    const { container } = render(
      <CommercialTable
        caption="Danh sách lệnh"
        columns={[
          { key: "symbol", label: "Mã", rowHeader: true },
          { key: "qty", label: "Khối lượng" },
        ]}
        rows={[{ id: "r1", cells: { symbol: "VIC", qty: 100 } }]}
      />,
    );
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table?.querySelector("caption")?.textContent).toBe("Danh sách lệnh");
    expect(table?.querySelectorAll('th[scope="col"]')).toHaveLength(2);
    expect(table?.querySelectorAll('th[scope="row"]')).toHaveLength(1);
    expect(table?.querySelectorAll("td")).toHaveLength(1);
  });

  it("CommercialTable: rỗng ⇒ hiện hàng thay thế, không vỡ layout", () => {
    const { container } = render(
      <CommercialTable caption="Danh sách rỗng" columns={[{ key: "symbol", label: "Mã" }]} rows={[]} empty="Chưa có dữ liệu" />,
    );
    const table = container.querySelector("table");
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(table?.textContent).toContain("Chưa có dữ liệu");
  });

  it("CommercialMeta: dl/dt/dd cho vùng metadata", () => {
    const { container } = render(
      <CommercialMeta items={[{ label: "Cập nhật lúc", value: "12:00" }, { label: "Nguồn", value: "API" }]} />,
    );
    const dl = container.querySelector("dl");
    expect(dl).not.toBeNull();
    expect(dl?.querySelectorAll("dt")).toHaveLength(2);
    expect(dl?.querySelectorAll("dd")).toHaveLength(2);
  });

  it("CommercialToolbar: nhóm có nhãn truy cập được", () => {
    render(<CommercialToolbar label="Bộ lọc"><button type="button">Lọc</button></CommercialToolbar>);
    const group = screen.getByRole("group", { name: "Bộ lọc" });
    expect(group).toBeTruthy();
  });

  it("CommercialState: dùng độc lập vẫn mount sẵn vùng live và vùng alert", () => {
    const { container } = render(<CommercialState />);
    expect(container.querySelector('[data-cm-zone="state"]')).not.toBeNull();
    expect(container.querySelector('[aria-live]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('[aria-busy]')?.getAttribute("aria-busy")).toBe("false");
  });
});
