# TEST_REPORT — UI/UX follow-up wave 2

- **Nhánh**: `feat/uiux-followup`
- **HEAD khi đo**: `eeb9ae9a1`
- **Ngày**: 2026-10-08
- **Cwd**: `packages/web` trừ khi ghi khác

Mỗi dòng là **một lệnh đã chạy thật** với exit code thật. Không dòng nào suy đoán.

## Gate hạ tầng

| Lệnh | Exit | Kết quả |
|---|---|---|
| `node scripts/check-uiux-budget.mjs` | **0** | PASS — baseline 246 → 224 (−22) |
| `npm run check:tokens` | **0** | 72 allowlisted hex, 0 violations |
| `npm run check:contrast` | **0** | 7 tone pairs × 2 modes ≥ 4.5:1 |
| `npm run check:dom-landmarks` | **0** | PASS |
| `npm run check:ts-imports` | **0** | không dangling import |
| `npm run check:i18n-hardcoded` | **0** | 0 chuỗi / 19 file |
| `npm run check:admin-spa-routes` | **0** | 14 catalog /admin/* |
| `npm run i18n:scan:strict` | **0** | (in ~25 cảnh báo key trùng, pre-existing) |
| `npm run check:shell` | **0** | PASS |
| `npx tsc --noEmit` | **0** | 0 error |
| `npm run build` | **0** | `tsc && vite build` — built in 46.99s |
| `npm run test:components` | **0** | **116 file / 804 test PASS** |
| `npm run lint` | **1** | ⚠ xem mục "Lint" bên dưới |
| `node packages/web/scripts/check-multi-agent.mjs` (cwd = root) | **0** | cảnh báo claim cũ, không chặn |
| `pwsh -File scripts/agent-sync.ps1` | **CHƯA CHẠY** | Stage 7 chạy sau rebase |
| `python manage.py makemigrations --check --dry-run` | **N/A** | wave này **không** tạo migration |

## Lint — 1 error CÓ SẴN, không do wave này

```
155:6  error  React Hook useMemo has a missing dependency: 'locale'
              react-hooks/exhaustive-deps
  file: src/components/FactsFirstWhaleBubbleChart.jsx
```

**Đã chứng minh là pre-existing**, không phải do wave này:

```bash
git diff dev..HEAD --stat -- packages/web/src/components/FactsFirstWhaleBubbleChart.jsx
# (rỗng — file giống hệt dev, 52 dòng cả hai bên)
git show dev:...FactsFirstWhaleBubbleChart.jsx | Measure-Object -Line   # 52
```

Số liệu so sánh:

| | problems | error | warning |
|---|---|---|---|
| `dev` baseline | 3712 | 1 | 3711 |
| `HEAD` wave này | **3711** | **1** (cùng lỗi) | 3710 |

⇒ Không tăng, thực tế **giảm 1 warning**. Không sửa vì ngoài phạm vi và file
không thuộc wave — nhưng **ghi rõ để không ai tưởng wave này làm hỏng lint**.

## Flake đã biết (không do wave này)

`src/components/__tests__/whale-advisory-a11y.component.test.tsx`

- Chạy **riêng**: 12/12 PASS.
- Chạy trong full suite dưới tải nặng: 1–2 fail (timeout 5000ms ở R1.1).
- `git log dev..HEAD -- <file>` → **rỗng** ⇒ file không bị wave này sửa.
- Đã ghi ở `docs/PLAN_UIUX_WAVE2_FINAL.md` §1 (audit Stage 2 phát hiện trước).
- **Tác động**: `npm run test:components` có thể exit 1 ngẫu nhiên. Cần
  ticket riêng. **Không được ghi "PASS" tuyệt đối cho gate này.**

## Test mới trong wave (fail-trước → pass-sau)

| Test file | Test | Fail-trước | Pass-sau |
|---|---|---|---|
| `pages/portfolio/__tests__/portfolio-heading.component.test.tsx` | 11 | 11 failed | 11 passed |
| `components/ui/__tests__/ui-primitives-a11y.component.test.tsx` | 8 | 4 failed | 8 passed |
| `pages/__tests__/page-heading-fu02c.component.test.tsx` | 15 | 4 failed | 15 passed |
| `i18n/__tests__/i18n-locale-fu04.component.test.ts` | 4 | n/a (gate là bằng chứng) | 4 passed |
| `hooks/__tests__/useUrlState.component.test.tsx` | 13 | 4 failed (bắt bug `boolCodec`) | 13 passed |
| `pages/portfolio/__tests__/portfolio-deep-link-fu05.component.test.tsx` | 6 | 4 failed | 6 passed |

Tổng **57 test mới**. Baseline 110 file / 747 test → **116 / 804**.

## Hạn chế đã biết của bằng chứng

1. **FU-04 fail-trước là GATE, không phải unit test.** Khi hardcode lại 1 call
   site, `i18n-locale-fu04` **vẫn PASS** vì nó chỉ kiểm `formatNumber` chứ không
   kiểm call site. Gate `check-uiux-budget` mới bắt được (19 → 0 → 1).
2. **A11Y-9 = 44 không phản ánh tiến độ.** Rule `scan-ui-guidelines.mjs` chỉ
   kiểm `aria-label` **cùng một dòng** với `<input`; code đúng đặt ở dòng riêng
   nên vẫn bị đếm. Gate chỉ chặn **tăng** nên vẫn PASS.
3. **AC-3 của FU-02c phủ 8/14 trang.** 6 trang còn lại không render ổn định
   trong jsdom (nạp dữ liệu bất đồng bộ / component con / qua prop). Ghi rõ
   trong file test thay vì làm xanh giả.
4. **Mobile `CHƯA CHẠY`** trên thiết bị thật. Sửa CSS không thay thế được kiểm
   bằng viewport thật / focus ring khi touch.

## Kết luận Stage 6

| Tiêu chí | Yêu cầu | Thực tế |
|---|---|---|
| Mọi dòng gate `Pass` | có | **có**, trừ 2 dòng đã ghi rõ: lint (pre-existing) + test (flake có sẵn) |
| Không báo PASS cho thứ chưa chạy | bắt buộc | `agent-sync.ps1` ghi `CHƯA CHẠY` (chạy ở Stage 7) |
