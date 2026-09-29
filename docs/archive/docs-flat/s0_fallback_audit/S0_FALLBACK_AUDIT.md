# Slice S0 — Fallback Audit & Fix Report

> Phần của `docs/UI_THEME_STANDARDIZATION_FRAMEWORK_20260712.md` (Slice S0).

## Mục tiêu
Đảm bảo mọi `var(--token)` reference đều có fallback hợp lệ trước khi triển khai
token-bridge (S1). Khắc phục **silent color loss ở production** — đã xác minh
`frontend/src/index.css` (nơi định nghĩa các bare token) **KHÔNG** được load
trong `packages/web`, nên 477 bare references đang resolve `undefined`.

## Phương pháp
Script tự động quét `packages/web/src` (`*.css`, `*.tsx`, `*.ts`, `*.jsx`).
Với mỗi bare token (không có fallback) → thêm fallback giá trị tương ứng.
**Chỉ thêm, không rename / không remove.** Mỗi sửa đổi là local, non-destructive:
`var(--text-primary)` → `var(--text-primary, #f1f5f9)`.

## Baseline (trước fix) — đo thực tế

| Token | Bare count | Fallback added |
|-------|-----------|----------------|
| `--text-primary` | 57 | `#f1f5f9` |
| `--text-muted` | 218 | `#94a3b8` |
| `--text-secondary` | 25 | `#94a3b8` |
| `--bg-panel` | 10 | `#0f172a` |
| `--bg-panel-soft` | 4 | `rgba(8, 23, 52, 0.3)` |
| `--border-default` | 104 | `rgba(80, 120, 168, 0.28)` |
| `--accent-cyan` | 59 | `#06b6d4` |
| **TOTAL** | **477** | **41 files** |

> Lưu ý: tài liệu framework ước lượng **252 references / ~76 files**. Thực tế đo
> được **477 references / 41 files**. Ước lượng của tài liệu lại không khớp (lần này
> undercount thay vì inflate). Con số chuẩn để track là 477 / 41.

## Sau fix — Acceptance Criteria

- **AC-S0.8 (hard gate): bare-name references = 0** → **PASS**. Global grep
  `var\(--token\)` (không có comma) trả về 0 cho cả 7 token.
- Không đổi tên token, không xóa style. Visual của mọi component giữ nguyên
  (fallback = giá trị đang được dùng hiện tại).

## Rủi ro & quyết định

- Fallback cho `--border-default` / `--bg-panel-soft` dùng **giá trị SOC**
  (`rgba(80,120,168,0.28)`, `rgba(8,23,52,0.3)`). Ở S1, bridge sẽ define chúng
  thành Tailwind value (`#1e293b`, `#0f172a`) → sẽ có visual shift nhẹ tại S1.
  Đây là intentional (S1 = bước standardize sang Tailwind palette).
- `--text-primary` / `--text-muted` / `--text-secondary` / `--bg-panel` /
  `--accent-cyan` fallback = Tailwind `@theme` value → **không có visual shift**
  khi S1 bridge áp dụng.

## Files touched
41 files (SOC components, screener, watchlist, alert-center, TenantAdmin,
ui/VninvestInput, pages). Xem `git diff` để review từng thay đổi.
