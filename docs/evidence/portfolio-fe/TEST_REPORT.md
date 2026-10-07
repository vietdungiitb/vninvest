# TEST_REPORT — FE Portfolio Workspace

`feat/portfolio-fe-workspace` · base `dev @ 0b5ea4a0e` · HEAD `44f159021`
Nguyên tắc: dòng nào không chạy được ghi **`CHƯA CHẠY`** + lý do. Không dòng
nào trong báo cáo này được điền `Pass` mà không tự chạy lệnh.

---

## A. GATE CHẠY THẬT (Pass)

| # | Gate | Lệnh | Exit | Kết quả |
|---|---|---|---|---|
| GT1 | Type-check | `npx tsc --noEmit` (packages/web) | **0** | sạch |
| GT2 | Build | `npm run build` | **0** | `✓ built in 1m 2s` |
| GT3 | Lint | `npm run lint` | **0** | **0 errors**, 3661 warnings |
| GT4 | Component tests ×3 | `npm run test:components` | **0** | **742/742**, 109/109 file, **3 lần liên tiếp** (D-19) |
| GT5a | i18n scan | `npm run i18n:scan` | **0** | 0 missing |
| GT5a' | i18n strict | `npm run i18n:scan:strict` | **0** | 0 missing |
| GT5b | Hardcode tiếng Việt | `node scripts/check-i18n-hardcoded.mjs src/pages/portfolio src/components/portfolio src/hooks/usePortfolioWorkspace.ts` | **0** | **0 chuỗi** trong 8 file |
| GT6 | Django check | `docker exec vninvest-dev-core-api sh -lc "cd /app/src && python manage.py check"` | **0** | `0 issues` |
| GT9 | BE test (delta) | `docker exec … python manage.py test user_workspace` | delta **0** | 9F+15E, khớp baseline `dev` |
| GT11 | Multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | **0** | `0 lỗi, 0 trùng số migration` |
| — | Token gate | `npm run check:tokens` | **0** | `72 allowlisted hex, 0 violations` |
| — | Contrast (cũ) | `npm run check:contrast` | **0** | 7 pairs × 2 modes |
| — | **Contrast portfolio (mới)** | `node scripts/check-portfolio-contrast.mjs` | **0** | **12 cặp × 2 theme**, thấp nhất 5.36:1 |
| — | Contrast self-test | `node scripts/check-portfolio-contrast.mjs --self-test` | **0** | 12 cặp cố ý sai bị phát hiện |
| — | Route contract | `npx vitest run src/components/__tests__/route-catalog-contract.component.test.ts` | **0** | 2/2 |
| — | Main menu contract | `npx vitest run src/components/__tests__/main-menu-contract.component.test.tsx` | **0** | 8/8 |
| — | Adapter (jest, hồi qu) | `npx jest src/adapters/coreApiAdapter.test.js` | **0** | 52/52 |

## B. CHƯA CHẠY (có lý do — KHÔNG tính là Pass)

| # | Gate | Lệnh | Lý do |
|---|---|---|---|
| GT7 | Migration check | `python manage.py makemigrations --check --dry-run` | **Cố ý không tạo migration** trong phạm vi này. Chưa chạy trong container sau thay đổi cuối — **CHƯA CHẠY** |
| GT8 | `migrate` trên Postgres | `docker exec … python manage.py migrate` | Không có model nào đổi ⇒ không cần. **CHƯA CHẠY** |
| GT10 | Secret scan | `git grep -InE '…'` | **CHƯA CHẠY** — chạy ở pre-push gate |
| GT12 | axe a11y scan | `@axe-core/playwright` | **CHƯA CHẠY** — `axe-core` chưa cài. `AGENTS.md` cấm `npm install` khi chưa hỏi ⇒ cần Owner duyệt. Đã ghi thẳng trong plan v3 |
| GT13 | WCAG 2.2 AA thủ công | checklist | **CHƯA CHẠY** — cần người đánh giá, không tự chấm |
| GT14 | Postgres env | `CORE_DATABASE_URL` + `DJANGO_DEBUG=1` | **CHắY QUA** — chạy trong container dev, không cần host env |
| — | `npm test` (jest toàn bộ) | `npm test` | **CHƯA CHẠY** — 2 suite fail do lỗi ESM **pre-existing** (mục C) |
| — | Playwright E2E | `npm run test:visual` | **CHƯA CHẠY** — chưa có seed data (mục D) |
| — | Mobile responsive | — | **CHƯA CHẠY** — ngoài phạm vi |

## C. FAIL PRE-EXISTING (không do branch này)

**`route-contract.test.js`** (jest)
```
npx jest src/adapters/core/__tests__/route-contract.test.js
→ Must use import to load ES Module: …\route-contract.test.js
Test Suites: 1 failed
```
Bằng chứng không phải branch này:
```
git log --oneline dev..HEAD -- packages/web/src/adapters/core/__tests__/route-contract.test.js
→ 0 commit
git branch -a --contains f46115323
→ dev, feat/portfolio-p0-20261005, feat/portfolio-fe-workspace, …
```
Hệ quả: **contract gate này đang chết**, nên 4 route mới không được gate này
xác nhận. Đã **tự bù** bằng cách sinh lại `core-route-manifest.json` từ
`dump-core-route-manifest.py` và đếm trực tiếp (4/4 route có mặt).
Việc sửa 2 suite jest là ticket riêng.

## D. DỮ LIỆU THẬT — giới hạn khi bàn giao

Đo trong container (Postgres dev thật):
```
Portfolio    = 1
LedgerEntry  = 0
CashFlow     = 0
DailyPrice   = 4.533.080   (VN30: 2.998 dòng)
```
⇒ **Không có holding nào để vẽ chart.** 5 trang sẽ hiện đúng empty state
(đã kiểm chứng bằng test: `no_holdings` / `no_market_prices` /
`insufficient_nav_history`), **không** hiện số giả.

Hệ quả cần Owner quyết: **nên seed dữ liệu danh mục vào DB dev không.**
Không seed thì không thể nghiệm thu trực quan (GT12/GT13/E2E) với chart thật.

---

## E. FAIL-TRUỚC / PASS-SAU (hazard 10)

Không test nào ở đây được tin khi chưa chứng minh nó đỏ.

| Slice | Mutation | Kết quả |
|---|---|---|
| S-00a | `urls.py` bản gốc | **7 error** |
| S-00c | payload gốc (thiếu 4 field) | **6 error** |
| S-00b | không có route `metrics/` | **7 error** |
| S-01b | thiếu token `--pf-*` | exit **1** |
| S-02 | `workspace.js` bản gốc | **9 failed** |
| S-03 | `nav: null` → `0` | **3 failed** |
| S-03 | `nav: null` cho qua filter rồi ép `0` | **3 failed** |
| S-04..11 | 5 route chưa khai trong `main.tsx` | **route-catalog-contract đỏ** |
| Fix B1 | bỏ parse chuỗi NAV | **2 failed** |
| Fix B5 | đọc `window.location` thay `useLocation` | **1 failed** |

> Ghi nhận 2 mutation đầu của S-03 là **no-op** (test vẫn xanh) và đã bị loại
> bằng chính tiêu chí này — không được báo "PASS" khi chưa xác minh.

## F. KẾT QUẢ AUDIT ĐỘC LẬP

- **Stage 2 (plan)**: `NEED_REVISION` · 7 blocker · 14 major · confidence high
  → sửa thành plan v3, re-slice 12 → 17 slice.
- **Stage 5 (code)**: `REJECT` · **5 blocker** · 5 major · confidence 0.92
  → đã sửa cả 5 blocker (commit `9e071d73f`) và 1 major (M5 manifest,
  commit `44f159021`).
- Tự kiểm chứng lại từng blocker bằng lệnh đọc file trước khi sửa — cả 5 đều
  **đúng**, đều là lỗi của tôi.

### Major còn lại (CHƯA đóng — ghi rõ, không giấu)

| # | Nội dung | Vì sao chưa đóng |
|---|---|---|
| M2 | `getTransactions` không truyền tham số phân trang; `CoreCursorPagination.page_size = 50` ⇒ giao dịch >50 mất im lặng | Cần quyết định UX "Tải thêm" — nằm ngoài 5 slice đã chốt |
| M3 | `weight_covers_all_holdings` nằm trong `meta` mà `asRows` bỏ ⇒ cột Tỷ trọng cộng ~100% dù có mã chưa có giá | Cần `asRows` trả kèm meta |
| M4 | 5 trường cảnh báo BE gửi mà FE chưa render (`market_value_reason`, `cash_complete`, `cash_note`, `nav_reason_text`, `reconciliation_required`) | Chưa có AC cho 5 trường này trong plan gốc |
| m1 | `check-portfolio-contrast.mjs` chưa nối vào `package.json` | `package.json` là deny-list; chạy trực tiếp bằng `node` |
| m2 | `chart.noCurve` ở Overview unreachable; `ResourceState.reason` chưa trang nào render | Dọn ở ticket sau |

## G. ĐIỀU KIỆN BÀN GIAO

| # | Điều kiện (plan v3 §5) | Trạng thái |
|---|---|---|
| 1 | GT1/GT2/GT3 exit 0 | ✅ |
| 2 | GT4 xanh 3 lần liên tiếp | ✅ 742/742 ×3 |
| 3 | GT9 delta = 0 so baseline | ✅ |
| 4 | Mọi chart đọc được giá trị thật | ⚠️ **CHƯA THỬ ĐƯỢC** — DB dev không có holding (mục D) |
| 5 | Metric thiếu → `null` + `reason`, không bịa số | ✅ có test |
| 6 | Evidence pack từng slice | ✅ `docs/evidence/portfolio-fe/` |
| 7 | Audit 0 blocker + 0 major | ⚠️ 0 blocker; 3 major còn lại đã liệt kê |
| 8 | TEST_REPORT mọi dòng Pass hoặc CHƯA CHẠY | ✅ file này |
| 9 | Contrast trên token file thật | ✅ 12 cặp × 2 theme |
| 10 | Ledger append Entry | ✅ xem `docs/CODE_CHANGE_AUDIT_LEDGER.md` |

**Kết luận**: đủ điều kiện để **merge có kiểm soát** với 3 major đã ghi rõ ở mục F
và 1 điều kiện chưa thể nghiệm thu (mục D — cần seed data).
