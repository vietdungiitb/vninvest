/**
 * `renderRoutePage()` — cây provider ĐẦY ĐỦ dùng chung cho các test đếm `<h1>`.
 *
 * Vì sao cần helper này: `page-heading-fu02c.component.test.tsx:214-225` ghi lại
 * 6 route có đúng 1 `<h1>` nhưng **chưa có test phòng thủ**, vì mỗi trang hỏng
 * trong jsdom một kiểu khác nhau. Riêng "cây provider đầy đủ" thôi chưa đủ — 2
 * trang có **nhánh return sớm không render `<h1>`**, nên còn phải mock adapter
 * (xem `page-heading-ac3.component.test.tsx`).
 *
 * Ba tầng provider ở đây là BẮT BUỘC, không phải cho đủ:
 *   - `PortfolioProvider` — `usePortfolio()` **throw** nếu thiếu
 *     (`PortfolioContext.js:718-721`); `SupportPage.tsx:46` và
 *     `UpgradePage.tsx:16` gọi nó ngay ở thân component.
 *   - `LangProvider` — `useI18n()` (`LangContext.d.ts:22`) cho
 *     `SupportPage.tsx:45` / `UserSettingsPage.tsx:90` / `UpgradePage.tsx:15`.
 *   - `ConfirmProvider` — `useConfirm()` **throw** nếu thiếu
 *     (`ConfirmModal.tsx:18-24`); `BrokerSettingsSection.tsx:66` (do
 *     `UserSettingsPage.tsx:5` import) và `WhaleAdvisoryPage.tsx:103` gọi nó.
 *
 * `routePath` là path khai thật trong `src/main.tsx` (không phải path bịa ra):
 * `ShellStockDetailPage` đọc `useParams().symbol` qua `StockDetailPage.tsx:54`
 * nên route sai sẽ cho `symbol = ""`.
 */
import { createElement } from "react";
import type { ComponentType } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ConfirmProvider } from "../../components/ConfirmModal";
import { LangProvider } from "../../context/LangContext";
import { PortfolioProvider } from "../../context/PortfolioContext";

export interface RenderRoutePageOptions {
  /** Component trang, đã nạp ở MODULE SCOPE của test (xem AC-2.4). */
  Component: ComponentType;
  /** Path khai trong `src/main.tsx` — dùng cho `<Route path>`. */
  routePath: string;
  /** URL khởi tạo cho router. Mặc định bằng `routePath`. */
  entry?: string;
}

export function renderRoutePage({ Component, routePath, entry }: RenderRoutePageOptions) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [entry ?? routePath] },
      createElement(
        ConfirmProvider,
        null,
        createElement(
          PortfolioProvider,
          null,
          createElement(
            LangProvider,
            null,
            createElement(
              Routes,
              null,
              createElement(Route, { path: routePath, element: createElement(Component) }),
            ),
          ),
        ),
      ),
    ),
  );
}
