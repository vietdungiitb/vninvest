# Audit v1 — plan `PLAN_WIDGET_ADJUSTED_PRICE_DISPLAY_20261124.md` (2026-11-24)

> Auditor độc lập (subagent `general`, chỉ đọc). Verdict: **NEED_REVISION**.
> Đã tự trace và xác nhận đúng: default `'raw'` không phá contract; tarball `0.4.7-ent` không có consumer render adjClose.

## Objections
1. **BLOCKER — cắm nhầm đường dữ liệu.** `useWidgetData.ts:250,253` lấy bar từ `useExternalBarsNormalization` → `history/externalBarsNormalization.ts:18-65` dựng object mới, bỏ `adj_close`/`adjClose`. Transform tại `:275`/`:1304-1314` sẽ `factor=NaN` → feature no-op. Phải sửa normalizer trước.
2. **§0 sai sự thật.** CSV hard-code `adjClose:null` ở `VNInvestCharts.tsx:1011-1023`, không dùng adjClose thật.
3. **Guard thiếu.** `adjustment.py:52` cho phép `stock_factor > 1` (ratio âm) ⇒ `adjClose > close`; plan chỉ chặn `≤ 0`. Rounding `Q2` (`:11,:100`) cần tolerance trong test.
4. **Side effects chưa phân tích.** Volume: lập luận "BE không scale" là non-sequitur cho display back-adjust (`useWidgetData.ts:1283-1289` volume profile). Compare bars raw (`:1168-1281`), drawings toạ độ giá thô, CSV ghi giá chỉnh mà `adj_close` vẫn null.
5. **Badge đổi sẽ lệch capability.** `ForkEngineSurface.tsx:147-149 → :424 → ChartStatusLine.tsx:417`; phải đồng bộ `ChartStatusLine.adjusted.test.tsx:72`, `conformanceContract.test.ts:14`, `CapabilityResolver.test.ts:162`, `capabilityProbe.ts:217-220`. Chọn một SSOT.
6. **Process/câu hỏi owner thiếu.** Chưa nêu `project-lessons`/`check-lessons.mjs`, `agent-sync.ps1`/`check-multi-agent.mjs`; thiếu câu hỏi chọn đường dữ liệu (host `data` prop vs widget tự fetch) + volume/compare/drawings/export.

## Phân công đóng
- Tác giả plan sửa 1, 2, 5 → gửi lại audit B3 (đã làm trong REVISION 1).
- Owner/coordinator chốt 3, 4, 6 (đã đưa vào §6 của plan).
