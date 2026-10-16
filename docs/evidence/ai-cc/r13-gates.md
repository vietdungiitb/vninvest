# R1.3 gates — i18n sạch AI CC (2026-10-16)

Branch `feat/ai-r13-i18n` ← `dev @ fb6fa2fca`. Claim `ai-r13`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:552-576`.
**Quyết định PM: làm R1.3 TRƯỚC R1.2** (R1.2 AC7 cần `loadError`; DAG cho phép: R1.3 chỉ phụ thuộc R0.5/R0.8).

## Fail-before
- Mới `ai-cc-i18n-clean.component.test.ts` (7 tests): RED đầu 4 failed (AC1/AC1b/AC3/AC5),
  sau khi chốt danh sách key chết đúng: **RED 5 failed (AC1/AC1b/AC2/AC3/AC5)**, AC6/AC7 GREEN sẵn.

## Bẫy scanner — bắt sống L-V01 trong phiên
- Scanner v1 (indexOf(ns+":") không neo) nuốt block comment/leaf, báo **117 key chết**.
- Fail-before cứu: test AC2 với 117 key này lại GREEN → mâu thuẫn → debug ra root cause
  (match nhầm `aiCommandCenter: 'Trung tâm AI'` ở dòng 98 thay vì block dòng 5354).
- Scanner v2 (neo `\n  ns:` + brace-matching) → **DEAD(22)**; verify độc lập lần 2
  (exact-match word-boundary trên mọi consumer) → **ALL 22 DEAD CONFIRMED** (+control
  dương `promptConfig.title` giữ đúng, control âm 6 key dài hơn `auditLogs*` loại đúng).
- Kết luận: plan ghi "18" là stale; số đúng đã verify là **22**.

## Thực hiện (xóa/thêm đối xứng vi+en, numstat)
- `i18n/vi.js + en.js`: **9+/22-** mỗi file. Thêm: `loadError`, `refreshIntervalValue`
  (`{hours}`), `customModel`, 6× `type*`. Xóa 22 key chết.
- Drawer: 12× `t()||"literal"` → `t()` + `||meta.labelKey` → `{defaultValue}` +
  xóa `SOURCE_KEYS` unused (eslint warning duy nhất trong 9 file). Diff 13/14.
- Nút close header là ký tự "✕" U+2715 (không phải "Đóng" như plan) → giữ nguyên.
- Page `:257` `${n} giờ/lần` → `t(refreshIntervalValue,{hours})`; test mock `t` nội suy.
- `providerModels`: 5 custom entries (không phải 4 — sót openclaw lúc đếm tay) +
  `labelKey`; renders form/federation `t(labelKey ?? label)`; `AGENT_TYPES` tương tự.
- `ErrorBoundary`: dịch qua stored locale (class, không hook được).
- Form `data?.message || t()` và `|| "openclaw"/24/"—"` là default dữ liệu → GIỮ
  (test AC3 dùng lookbehind để không match nhầm `set(/get(`).

## Gates (EXIT=0)
- vitest mới **7/7**; hồi quy 6 files AI CC **29/29** (page/AISliceE/drawer/parity/form/smoke)
- `tsc` 0 · `eslint` 9 files **0 warning** · `i18n:scan:strict` 0 · `check-ai-cc` SẠCH
- `npm run build` PASS · `check-multi-agent` 0 lỗi · pre-push (lúc push)

## CHƯA CHẠY
- AC5 render EN toàn trang (thay bằng source-contract: 0 ký tự Việt trong 9 file,
  đã loại comment; giới hạn: `//` trong string sẽ đánh lừa — đã grep `https?://` = 0).
- Full BE / ruff / E2E UI / visual staging.
