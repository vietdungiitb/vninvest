# IMPLEMENTATION PLAN — Screener `/screener` P0 correctness (không code ở bước này)

> Ngày lập: 2026-09-13 · Nguồn: `docs/AUDIT_SCREENER_COMMERCIAL_GRADE_20260913.md` (§A–I) + 6 quyết định mục F (ledger Entry 64).
> Phạm vi: **P0 correctness** — F2, F3, F4, F5, F10, F11, F12-nhỏ + tests (audit §G).
> Nguyên tắc: mỗi sub-step xong chạy `npx tsc --noEmit`; cuối step `npm run build`; mọi thay đổi 1 ledger entry.

## 0. Quyết định F đã chốt (khóa scope)

| # | Quyết định | Tác động tới P0 |
|---|---|---|
| Q1 | Universe = **toàn bộ 3 sàn** (~1200 mã) | P0 không giới hạn universe; P1 mới batch/celery |
| Q2 | Whale/Dark thiếu → **hiển thị "thiếu dữ liệu"** (badge), không ẩn cột | P0.1 bắt buộc badge + metadata thiếu dữ liệu |
| Q3 | Công thức = **nội bộ + tư liệu** (tooltip/doc), P3 mới calibrate vendor | P0 không sửa công thức chỉ báo |
| Q4 | Export = **cả hai**: CSV BOM mặc định + nút Excel `.xlsx` thật (SheetJS) | P0.2 làm cả 2 path + thêm dep `xlsx` |
| Q5 | History = **server theo user+tenant** (P2.5) | P0 không đụng history store (chỉ test `buildTrades` hiện tại) |
| Q6 | Lịch quét = **có lịch + alert** (P2.4) | P0 không làm lịch |

## 1. Hiệu chỉnh audit ↔ code (đã đọc lại code ngày 2026-09-13, plan này là chuẩn)

1. **F2 chưa chính xác hoàn toàn**: nhánh `else` (`portfolio_analytics_views.py:1454-1463`) **đã** populate 8 field = `0.0`, KHÔNG phải "không populate". Thiếu thật là: (a) 5 field suy ra được từ `SessionFacts` nhưng `else` bỏ sót — `whale_buy_value`, `whale_sell_value`, `whale_total_value`, `whale_buy_pct`, `whale_sell_pct`; (b) 6 field allowlist **không có nguồn nào** trong `SessionFacts` (`models.py:69-112` chỉ có `cvd_normalized`, `buy_strength`, `institutional_strength`, `whale_net_flow`, `dark_flow_score`, `total_buy_volume`, `total_sell_volume`) — `whale_unknown_value`, `whale_unknown_pct`, `whale_trade_count`, `whale_whale_value`, `whale_shark_value`, `whale_small_value`. P0.1 xử lý đúng 2 nhóm này (không "populate đủ" mù).
2. **F9**: `buildTrades` (`screenerHistoryStore.ts:52-84`) **không dùng** key `${symbol}-${entry}` như audit viết — lúc thực thi P0.7 xác minh lại rồi test theo hành vi thật.
3. **Deviation khỏi audit**: audit viết "list/run tôn trọng `is_active`" (§G-P0.6). Plan quyết định rõ: **list + detail-GET lọc `is_active=True`; run CHO PHÉP rule inactive** để phục vụ flow "Chạy thử" (P0.4) — FE chỉ expose nút Chạy cho rule active + flow preview. Lý do: backend run bắt buộc rule đã lưu (`run/` cần `<pk>`); tạo rule `is_active=False` làm preview là cách không thêm endpoint mà vẫn đúng "không lưu (vào danh sách)".
4. `ScreenerExport.tsx` **chưa dùng `useI18n`** — P0.2 phải đưa `t()` vào (prop hoặc hook), không chỉ "resolve label".
5. `vi.js` block screener có dòng **mojibake** (`templates.title: 'M?u l?c c� s?n'`, khoảng `vi.js:2468`) — P0.5 phải sửa file ở chế độ UTF-8 và kiểm tra diff không vỡ encoding.
6. `ScreenerPage.tsx:2` import **named** `{ coreApiAdapter }` từ `../adapters/coreApiAdapter.js` (không phải `defaultCoreApiAdapter` pattern như TenantAdmin) — P0.7 mock đúng module này.
7. Phần admin của `adapters/core/screener.js` (`/portfolio/admin/screener/*`, `:3-27,44-46`) **CHƯA XÁC MINH** có route BE hay không — P0.6 bắt buộc grep route trước khi xóa; chỉ chắc chắn chết là `runScreener`/`getScreenerResults` (`:33-42` trỏ `/portfolio/screener/...`, không tồn tại theo `user_workspace/urls.py:78-81`).

## 2. P0.1 — Flow-facts đầy đủ + badge "thiếu dữ liệu" + banner staleness (F2)

**Hiện trạng (đã xác minh):** `portfolio_analytics_views.py:1436-1470` dựng `flow_facts`; nhánh có-facts `:1439-1453`, nhánh thiếu `:1455-1463` (8 field = 0.0); `_apply_screener_condition` (`screener_helpers.py:54-67`) trả `False` khi `None`; response `:1503-1509` chỉ có `rule_id/rule_name/total_scanned/matched_count/matched` (không `session_date`, không metadata thiếu).

**Thiết kế thay đổi (BE, `portfolio_analytics_views.py` + không đổi contract cũ — chỉ thêm field response):**
- (a) Nhánh `else`: populate thêm 5 field suy ra được = `0`/`0.0` (`whale_buy_value/sell/total_value`, `whale_buy_pct/sell_pct`) để đồng nhất shape với nhánh có-facts.
- (b) 6 field vô nguồn (§1.1b): gán `None` ở **cả hai nhánh** + thu thập `missing_fields` (union các field `None` xuất hiện trong `conditions`) và `missing_counts: {field: số mã thiếu}`.
- (c) Giữ nguyên ngữ nghĩa `_apply_screener_condition(None) → False` (không đổi helper).
- (d) Response thêm: `session_date` (ISO), `is_stale` (`session_date < today`), `days_old`, `missing_fields: string[]`, `missing_counts: Record<string, number>`.
- (e) FE (`ScreenerResultsTable.tsx` + `ScreenerPage.tsx`): banner staleness khi `is_stale` ("Dữ liệu phiên {date} — cũ {n} ngày"); badge "thiếu dữ liệu (x/y mã)" khi `missing_fields` non-empty (Q2). Types `ScreenerResult` (`screener.ts:141-147` + `.d.ts:64-70`) thêm 5 field optional.

**Yêu cầu phải đạt:**
- [ ] R1.1 Mọi field allowlist whale/dark đều có mặt trong `row` ở cả hai nhánh (số hoặc `None`, không bao giờ key-missing).
- [ ] R1.2 Condition trỏ field vô nguồn → matched không chứa mã "ăn may", và `missing_fields` chứa field đó.
- [ ] R1.3 `is_stale=True` đúng khi snapshot cũ hơn hôm nay; banner FE hiện đúng text + ngày.
- [ ] R1.4 Không vỡ contract cũ: 5 key response cũ giữ nguyên tên/kiểu.

**Minh chứng:** `python manage.py test user_workspace.tests.test_screener_rule_run` pass (case thiếu facts + case stale — xem P0.7); screenshot `/screener` VI: banner staleness + badge thiếu dữ liệu khi chạy mẫu `whale_accumulation`.

## 3. P0.2 — Export: label dịch + CSV BOM + `.xlsx` thật (F3, Q4 = cả hai)

**Hiện trạng (đã xác minh):** `ScreenerExport.tsx:22-35` header = `labelKey` thô, không BOM; `:37-88` XML SpreadsheetML nhưng lưu `.xlsx` (`:109-113`); chưa dùng `useI18n`; `package.json` **chưa có** dep `xlsx`; `visibleColumns` đã có `labelKey` (`ScreenerResultsTable.tsx:141`).

**Thiết kế thay đổi (FE):**
- (a) Thêm dep `xlsx` (`^0.18.5`, Apache-2.0) — cài lúc thực thi (`npm install xlsx`, repo dùng `--legacy-peer-deps` trong Dockerfile).
- (b) Trích helper mới `src/components/screener/screenerExportUtils.ts`: `buildCSVRows(headers, rows)` (quote + escape), dùng cho cả CSV và XLSX để test được (P0.7).
- (c) `ScreenerExport` dùng `useI18n().t` resolve `labelKey` (fallback = key khi thiếu); CSV = `\uFEFF` + headers dịch + mime `text/csv;charset=utf-8`; nút Excel dùng SheetJS (`aoa_to_sheet`, giữ number là number, `null → ""`, set `wch` autofit) + `writeFile` → `.xlsx` thật; filename `screener-{ruleSlug}-{date}.csv/.xlsx`.
- (d) i18n: dùng lại key `screener.columns.*` hiện có; thêm key mới cho 2 nút nếu chưa có (kiểm tra `screenerBtnCsv/screenerBtnExcel` lúc làm — xem §8).

**Yêu cầu phải đạt:**
- [ ] R2.1 Header CSV/XLSX là text Việt đã dịch (không còn `screener.columns.*`).
- [ ] R2.2 CSV mở bằng Excel Windows hiện đúng tiếng Việt (BOM), không vỡ font.
- [ ] R2.3 File `.xlsx` mở bằng Excel/LibreOffice **không cảnh báo định dạng**, số là số (căn phải, sort được).
- [ ] R2.4 Không regression: export rỗng (0 matched) vẫn ra file chỉ có header.

**Minh chứng:** unit test `screenerExportUtils.test.ts` (BOM đầu file, header dịch, quote/escape, `""` cho null); file mẫu `docs/evidence/screener-p0/export-vi.{csv,xlsx}` + screenshot mở bằng Excel không cảnh báo.

## 4. P0.3 — Field-picker hoạt động + giữ rỗng/NaN + validate miền (F4)

**Hiện trạng (đã xác minh):** checkbox picker `onChange: () => {}` (`ScreenerFilterBuilder.tsx:190-197`); input ép `parseFloat(...) || 0` (`:113`) khiến `valueRequired/valueNumber` (`ScreenerPage.tsx:31-34`) unreachable; chưa có validate miền nào.

**Thiết kế thay đổi (FE):**
- (a) Mở type `ScreenerCondition.value: number | ""` (`screener.ts:90-95` + `.d.ts:1-6`); input giữ `""` khi xóa rỗng (`e.target.value === "" ? "" : Number(...)`); `RuleEditor.handleSave` ép `Number` chỉ sau khi validate qua (logic hiện tại `:29-37` lúc đó mới hoạt động thật).
- (b) Picker checkbox toggle thật: check → append `{field, op: defaultOp, value: defaultValue, logic: "AND"}`; uncheck → xóa condition đầu tiên trùng field (không cho xóa khi chỉ còn 1 condition — giữ quy tắc `removeCondition`).
- (c) Mở rộng registry `screener.ts` (single source, xem P0.6): mỗi field thêm `defaultOp/defaultValue/min/max` — bảng miền tối thiểu: `rsi_14/stochastic_k/stochastic_d/mfi_14/adx_14`: 0–100; `whale_buy_pct/whale_sell_pct/range_position_pct`: 0–100; `volume/avg_volume_20/volume_rvol`: ≥ 0; còn lại: hữu hạn (chặn NaN/Infinity). Lỗi miền dùng key mới `screener.errors.valueRange` (min/max interpolate).
- (d) BE không đổi (`_validate_screener_rules` vẫn chặn non-number → 400 là lưới cuối).

**Yêu cầu phải đạt:**
- [ ] R3.1 Nhập rỗng → báo `valueRequired`; nhập chữ (qua paste) → `valueNumber` (không còn âm thầm thành 0).
- [ ] R3.2 RSI = 150 → báo `valueRange` (0–100); RVOL = -1 → báo range.
- [ ] R3.3 Check/uncheck trong picker thêm/xóa condition tương ứng và đồng bộ `checked` state.
- [ ] R3.4 Rule lưu BE vẫn pass `_validate_screener_rules` (value luôn là number sau save).

**Minh chứng:** `screenerValidation.test.ts` (helper mới trích từ RuleEditor/picker: rỗng/NaN/range/picker-toggle); quay clip hoặc 2 screenshot (lỗi rỗng + lỗi range) ở `/screener` VI.

## 5. P0.4 — Template: "Chạy thử" không lưu + "Lưu thành rule" dedupe (F5)

**Hiện trạng (đã xác minh):** `handleApplyTemplate` (`ScreenerPage.tsx:155-185`) luôn `createScreenerRule` rồi run; mỗi card 1 nút (`ScreenerTemplates.tsx:87-106`).

**Thiết kế thay đổi (FE, không đổi BE — dựa deviation §1.3):**
- (a) Helper mới `screenerRuleDedupe.ts`: `canonicalRules(rules_json)` (sort keys từng condition, chuẩn hóa number, bỏ `logic` rỗng ở condition đầu) + `findDuplicate(rules, canonical)` so sánh với rules đã load.
- (b) Mỗi template card 2 nút: **[Chạy thử]** và **[Lưu thành rule]** (thêm i18n keys, §8).
  - *Chạy thử*: dedupe trước — trùng rule sẵn có → `confirm` "Đã có rule '<name>' cấu hình giống hệt. Dùng để chạy?" → run rule đó; chưa có → tạo rule `is_active=False` (+ tiền tố tên `[Thử] `) → run → banner "Kết quả chạy thử — chưa lưu thành rule"; trước khi tạo mới, **xóa rule thử trước đó** của phiên (client nhớ id) để không rác DB.
  - *Lưu thành rule*: dedupe — trùng → confirm dùng rule cũ (chuyển sang edit/run) hoặc tạo mới với hậu tố ` (2)` khi trùng tên; tạo xong toast + reload list, **không auto-run**.
- (c) `applyingId` dùng chung cho cả hai flow; lỗi run preview xóa banner thử.

**Yêu cầu phải đạt:**
- [ ] R4.1 Click "Chạy thử" 5 lần cùng mẫu → tối đa 1 rule `[Thử]` tồn tại (không spam), list rule không hiện rule thử (nhờ P0.6 lọc `is_active`).
- [ ] R4.2 "Lưu thành rule" 2 lần cùng mẫu → lần 2 hiện confirm dedupe, không tạo bản trùng im lặng.
- [ ] R4.3 Rule thử vẫn chạy ra kết quả (run cho phép inactive — §1.3).

**Minh chứng:** `screenerRuleDedupe.test.ts` (trùng/khác thứ tự key/khác value/hậu tố tên); screenshot 2 nút trên card + banner chạy thử; kiểm tra DB/list không có rule rác sau 3 lần thử.

## 6. P0.5 — i18n full dấu block screener (F10)

**Hiện trạng (đã xác minh mẫu):** `vi.js:2389` (`aiScore: 'Diem AI'`), `:2398` (`avgVol20: 'KLGD TB 20 ngay'`), `:2399` (`rangePos: 'Vi tri 52 tuan %'`), group `:2461-2466` (`Gia & Khoi luong`, `Dong luong & Xu huong`, `Duong TB dong`, `Chi bao nang cao`, `Khoi luong`, `Vi tri gia`, `Ca voi & Dark Pool`, `Co ban`), `:2366` label "AND logic" trong khi engine hỗ trợ AND/OR/NOT, `columnsBtn` cần sửa thành `'Cột'`, và **mojibake** `templates.title` (~`:2468`).

**Thiết kế:** sweep toàn block `vi.js:2360-2533` ở chế độ UTF-8 (không convert encoding), sửa mọi thiếu dấu + mojibake, đối chiếu 1-1 với `en.js:2362-2535` (không thêm/bớt key ngoài §8), sửa `conditionsLabel` theo logic thực (AND/OR/NOT), `columnsBtn: 'Cột'`.

**Yêu cầu phải đạt:**
- [ ] R5.1 `grep` toàn block không còn mẫu thiếu dấu phổ biến (`Diem|Cot |Gia |Khoi|Vi tri|Duong|Co ban|Ca voi|...` — liệt kê đầy đủ lúc làm).
- [ ] R5.2 Không còn ký tự `?`/`` (mojibake) trong block; file vẫn UTF-8 hợp lệ (`git diff` sạch).
- [ ] R5.3 Mọi key VI render đúng trên `/screener` ở locale VI (screenshot đầu trang + builder + bảng).

**Minh chứng:** screenshot `/screener` VI sau sửa (3 vùng: header, builder, table); `git diff --stat` chỉ chạm `vi.js` (+ `en.js` nếu thêm key §8).

## 7. P0.6 — Xóa adapter chết + gộp registry + `is_active` (F11, F12-nhỏ)

**Hiện trạng (đã xác minh một phần):** `adapters/core/screener.js:33-42` chết chắc; admin `:3-27,44-46` CHƯA XÁC MINH (§1.7); `.d.ts:73-162` chứa `const` runtime trùng `screener.ts:1-88` (C3); list (`views.py:464-470`) và detail-GET (`portfolio_analytics_views.py:1319-1322`) không lọc `is_active` (model default `True`, serializer đã expose).

**Thiết kế thay đổi:**
- (a) **Verify-then-delete**: `grep -rn "createScreenerClient\|adapters/core/screener" packages/web/src` + grep route BE `/portfolio/admin/screener` và `/portfolio/screener` (cả `user_workspace` và `service_ops`). Xóa hàm chết đã xác minh; phần admin nếu có route thật thì giữ + sửa comment, không xóa mù.
- (b) `.d.ts`: xóa toàn bộ `const` (`SCREENER_FIELD_GROUPS`, `OP_OPTIONS`, `LOGIC_OPTIONS`, `ScreenerFieldKey` trùng) — chỉ giữ `interface/type`. Trước khi xóa, grep `from ["'].*screener\.d\.ts["']` đảm bảo mọi import là `import type` (hiện tại 5 file đều `import type`/type-only — xác minh lại lúc làm). `screener.ts` là single source (P0.3 bổ sung `defaultOp/defaultValue/min/max` vào đây).
- (c) BE: list GET thêm `.filter(is_active=True)`; detail-GET 404 khi `is_active=False` (PUT/DELETE giữ `_get_rule` để còn bật/xóa lại được); run giữ nguyên (cho phép inactive — deviation §1.3, ghi comment trong code).

**Yêu cầu phải đạt:**
- [ ] R6.1 Không còn import/call tới endpoint đã xóa (grep 0 kết quả sau sửa).
- [ ] R6.2 `tsc` pass sau khi rút const khỏi `.d.ts` (không file nào import runtime từ `.d.ts`).
- [ ] R6.3 Rule `is_active=False` vắng khỏi list nhưng vẫn run được (test BE).

**Minh chứng:** log grep trước/sau; case test BE list-vs-run inactive (P0.7).

## 8. i18n keys mới (thêm cả `vi.js` + `en.js`, P0.2/P0.3/P0.4)

| Key | VI | EN |
|---|---|---|
| `screener.missingDataBadge` | `Thiếu dữ liệu ({missing}/{total} mã)` | `Missing data ({missing}/{total} symbols)` |
| `screener.staleBanner` | `Dữ liệu phiên {date} — cũ {days} ngày` | `Session data {date} — {days} days old` |
| `screener.previewBanner` | `Kết quả chạy thử — chưa lưu thành rule` | `Preview run — not saved as a rule` |
| `screener.templates.preview` | `Chạy thử` | `Preview` |
| `screener.templates.saveAsRule` | `Lưu thành rule` | `Save as rule` |
| `screener.duplicateRuleConfirm` | `Đã có rule '{name}' cấu hình giống hệt. Dùng để chạy?` | `Rule '{name}' has identical config. Use it to run?` |
| `screener.duplicateNameSuffix` | ` (2)` | ` (2)` |
| `screener.errors.valueRange` | `Giá trị phải trong khoảng {min}–{max} ({field})` | `Value must be between {min}–{max} ({field})` |
| `screener.export.csv` | `CSV` | `CSV` |
| `screener.export.excel` | `Excel (.xlsx)` | `Excel (.xlsx)` |

## 9. P0.7 — Tests (lấp khoảng E: hiện 0 test cho user-screener)

| # | File test mới | Target | Case tối thiểu |
|---|---|---|---|
| T1 | `packages/web/src/components/screener/__tests__/screenerHistoryStore.test.ts` | `buildTrades` (hành vi thật, §1.2) | BUY win/loss, SELL ngược, exit từ `currentPrices` vs run sau, thiếu exit → bỏ, rows rỗng |
| T2 | `.../__tests__/screenerExportUtils.test.ts` | helper mới P0.2 | BOM đầu CSV, header dịch, quote + escape `"`, `null → ""`, aoa numbers giữ number |
| T3 | `.../__tests__/screenerValidation.test.ts` + `screenerRuleDedupe.test.ts` | helpers mới P0.3/P0.4 | rỗng/NaN/range từng miền; canonical trùng khi đảo thứ tự key, khác khi đổi value |
| T4 | `packages/web/src/components/screener/__tests__/ScreenerResultsTable.component.test.tsx` | sort + paging + picker | mock result 26 rows: sort click đổi ▲▼, 2 trang, toggle cột ẩn/hiện; mock `LangContext` (`t: k=>k`) theo mẫu `TenantAdminRolesPage.component.test.tsx`; KHÔNG click nút Excel (tránh `writeFile` trong jsdom) |
| T5 | `packages/core/backend/src/user_workspace/tests/test_screener_rule_run.py` (mới) | run/list/validate BE | tạo tối thiểu `SymbolSnapshot` + `SessionFacts` + `DailyPrice` (đọc field bắt buộc của model trước khi viết); mock `get_company_financials_response`; assert matched đúng, `missing_fields`/`missing_counts`, `session_date`/`is_stale`, inactive vắng khỏi list nhưng run được, POST rule field lạ/value string → 400 |

**Lưu ý thực thi T5:** xác minh settings DB cho test và `tenant` nullable-flow (`tenant` FK `null=False` nhưng view chịu `tenant=None` — test tạo rule trực tiếp qua ORM với tenant thật hoặc theo mẫu test hiện có của `user_workspace`).

**Yêu cầu phải đạt:**
- [ ] R7.1 `npx vitest run src/components/screener` — 5 files pass, 0 fail.
- [ ] R7.2 `python manage.py test user_workspace` (cwd `packages/core/backend`, venv) — pass, không regress test cũ (`tests.py`, `test_portfolio_*.py`).
- [ ] R7.3 Không test nào phụ thuộc network (mock vnbroker adapter) hay localStorage thật (mock hoặc jsdom có sẵn).

## 10. Thứ tự thực thi + ước lượng (~1 sprint / 5 ngày)

1. **P0.6** (0.5d) — nền: registry single-source + `is_active` (P0.4 phụ thuộc).
2. **P0.5** (0.5d) — nền: i18n (P0.2/P0.3/P0.4 dùng keys).
3. **P0.1** (1d) — BE độc lập, song song được với 1–2.
4. **P0.2** (1d) — cần dep `xlsx` + keys §8.
5. **P0.3** (1d) — cần registry P0.6 + keys §8.
6. **P0.4** (1d) — cần P0.6 (`is_active` filter) + dedupe helper.
7. **P0.7** (1d, gối đầu) — viết cùng mỗi item, chốt cuối.

## 11. Quality gates (bắt buộc mỗi sub-step / step)

- FE sub-step: `npx tsc --noEmit` (cwd `packages/web`) → exit 0; scope lint `npx eslint src/components/screener/ src/pages/ScreenerPage.tsx src/types/screener.ts --max-warnings 0` → 0 errors (warnings hiện có: 5 `jsx-no-literals` — không tăng thêm).
- Cuối step: `npm run build` (tsc + vite) exit 0.
- BE sub-step: `python manage.py test user_workspace` pass.
- Cuối P0: `npx vitest run src/components/screener` pass + smoke `GET /screener → 200` + 3 screenshots VI (`docs/evidence/screener-p0/`).
- Ledger: 1 entry / thay đổi mã nguồn theo quy ước repo.

## 12. Out-of-scope P0 (đã khóa — sang P1/P2/P3)

P1: sort/phân trang server, cache `(tenant, rule_hash, session_date)`, celery run dài, batch financials, rate-limit, giới hạn window DailyPrice, index DB. P2: URL share, React Query, backtest v2 + history server (Q5), lịch quét + alert (Q6), watchlist/alert từ dòng. P3: calibrate vendor (Q3), preset cộng đồng, realtime intraday. Tuyệt đối không sửa công thức chỉ báo trong P0 (Q3).
