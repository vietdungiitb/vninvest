// @vitest-environment jsdom
/**
 * Bảo vệ `useI18n()` khi KHÔNG có `LangProvider`.
 *
 * Lỗi gốc (claim `pf-manage-rebuild`, 2026-10-13): `useI18n()` tạo object mới
 * **mỗi lần render** ở nhánh fallback ⇒ `t` đổi identity mỗi render ⇒
 * `useCallback`/`useMemo` có dep là `t` đổi identity ⇒ effect gọi lại vô hạn.
 *
 * Bằng chứng lúc phát hiện: `DNSEConnectionPanel` sau khi i18n hoá bị **kẹt vĩnh
 * viễn** ở "Đang tải trạng thái DNSE..." và `dnse-order-mode-badge` đỏ 3/3 —
 * `reload` đổi identity mỗi render ⇒ `useEffect(..., [reload])` gọi
 * `getDNSEConfig()` lặp. Panel cũ không dính vì **không** dùng `t` ở đâu cả.
 *
 * Test khoá **HÀNH VI** (identity ổn định qua nhiều render thật), không khoá
 * giá trị — vì lỗi nằm ở identity chứ không phải ở giá trị.
 */

import { describe, expect, test } from "vitest";
import { createElement, useEffect, useState } from "react";
import { render } from "@testing-library/react";
import { useI18n } from "../LangContext";

const SEEN_I18N: unknown[] = [];
const SEEN_FNS: unknown[] = [];
let EFFECT_RUNS = 0;

function reset() {
  SEEN_I18N.length = 0;
  SEEN_FNS.length = 0;
  EFFECT_RUNS = 0;
}

/**
 * Render LẶP LẠI thật. Gọi `rerender()` liên tiếp không đủ: React gộp các
 * lần cập nhật không đổi state thành một lần render duy nhất. Counter trong
 * state bảo đảm mỗi vòng đều là một render riêng.
 */
function Probe() {
  const [n, setN] = useState(0);
  const i18n = useI18n();

  SEEN_I18N.push(i18n);
  SEEN_FNS.push(i18n.t, i18n.formatNumber, i18n.formatDateTime, i18n.formatCurrency);

  useEffect(() => {
    EFFECT_RUNS += 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.t]);

  useEffect(() => {
    if (n < 4) setN(n + 1);
  }, [n]);

  return null;
}

function runProbe() {
  render(createElement(Probe));
}

describe("useI18n() fallback khi không có LangProvider", () => {
  test("trả về CÙNG một object qua nhiều lần render", () => {
    reset();
    runProbe();
    expect(SEEN_I18N.length).toBeGreaterThanOrEqual(4);
    // Nếu hook trả object literal tạo trong thân hàm, mỗi render sẽ khác nhau.
    expect(SEEN_I18N[0]).toBe(SEEN_I18N[1]);
    expect(SEEN_I18N[1]).toBe(SEEN_I18N[2]);
    expect(SEEN_I18N[2]).toBe(SEEN_I18N[3]);
  });

  test("`t` giữ identity ổn định ⇒ effect theo dep `t` KHÔNG chạy lại", () => {
    reset();
    runProbe();
    // Chỉ chạy 1 lần lúc mount. Nếu `t` đổi identity mỗi render thì con số
    // này bằng số vòng render.
    expect(EFFECT_RUNS).toBe(1);
  });

  test("mọi hàm format cũng giữ identity ổn định", () => {
    reset();
    runProbe();
    // 4 hàm × >= 4 render
    expect(SEEN_FNS.length).toBeGreaterThanOrEqual(16);
    for (let i = 0; i < 4; i += 1) {
      expect(SEEN_FNS[i]).toBe(SEEN_FNS[i + 4]);
      expect(SEEN_FNS[i]).toBe(SEEN_FNS[i + 8]);
    }
  });

  test("vẫn trả defaultValue / key y như trước", () => {
    const view = render(
      createElement(function TextProbe() {
        const { t } = useI18n();
        return createElement("div", null, t("a.b", { defaultValue: "mặc định" }), "|", t("c.d"));
      }),
    );
    expect(view.container.textContent).toBe("mặc định|c.d");
  });
});