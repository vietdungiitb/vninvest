# RE-AUDIT độc lập — Whale/CVD Full Timeframe (2026-11-25)

**5 findings nghiêm trọng nhất:** (1) `stock_mgmt_native_views.py:2246` dùng `timezone.utc` (đã bị Django 5 xoá) ⇒ **500 chắc chắn** trên daily/weekly whale signals — đã đổi `dt_timezone.utc`; (2) `VNStockChartPanel.js:364` ưu tiên `matched_value` (VND) làm trục giá ⇒ fix `price: s.price ?? s.value` ở page **vô tác dụng** — đã đổi `matched_value: s.price ?? …` tại `StockDetailPage.tsx:155`; (3) whale-feed `?window` phân biệt hoa thường, không alias `1d`, window lạ rơi êm về per-tick — đã canonical hoá + trả `400 UNSUPPORTED_WINDOW`; (4) FE mock adapter thiếu `getDarkMoneyHistory` ⇒ gate "13/13" cũ **vacuous** — đã thêm 3 test thật (giờ 16/16); (5) tài liệu handoff/audit/ledger tự mâu thuẫn (branch cũ, build fail, widget 1.2.5, Entry 58 đặt cuối file) — đã đính chính toàn bộ.

## 0. Nguyên tắc / phạm vi
- Hai subagent đọc độc lập: BE (`ses_dee098e29ffec`) + FE/docs (`ses_dee098e28ffej`). Kết quả được ghi lại ở §5; mọi finding đều có `file:line` và trạng thái xử lý.
- Mọi khẳng định kèm `file:line`. Chưa chạy ⇒ ghi `CHƯA CHẠY`. Subagent chạy read-only nên không tự chạy gate; số liệu gate ở §4 là do coordinator tự chạy lại.
- Scope: thay đổi trên `feat/whale-cvd-full-tf` (base `origin/dev`): BE CVD/whale + FE wiring + docs/handoff.
- Đối chiếu: `docs/RESEARCH_WHALE_CVD_FULL_TIMEFRAME_20261125.md`, handoff widget, `docs/DECISION_WHALE_CVD_API_CONTRACT_20261124.md` REV.2.2.

## 1. Đọc trước
AGENTS.md, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, research doc, audit v1, handoff doc.

## 2. Phạm vi nghiên cứu
- **A. BE**: `market_data/stock_mgmt_native_views.py` (helper CVD + whale_signals), `market_serving/native_views.py` (whale buckets + view), `market_serving/session_facts_engine.py`, `market_serving/views.py`.
- **B. FE**: `features/stock-detail/hooks/useStockDetailPageModel.js`, `pages/StockDetailPage.tsx`, `components/VNStockChartPanel.js`, `adapters/VNInvestSignalAdapter` (`src/utils/VNInvestSignalAdapter.js`).
- **C. Contract ngoài**: `vninvestcharts-widget` tgz `0.4.7-ent` (`packages/web/package.json:107`), `externalCvdSeries`/`whaleOrders`, handoff `docs/handoffs/HANDOFF_2026-11-25_WHALE_CVD_WIDGET.md`.
- **D. Gates**: `py_compile`, BE test VPS Postgres, `tsc --noEmit`, `vitest`, `npm run build`.

## 3. Phương pháp
B1 đọc docs → B2 `git diff`/`git status` → B3 grep symbols → B4 đọc `file:line` + trace 1 use-case (dark-money 1D → FE override → panel → widget) → B5 đối chiếu research/decision ↔ code → B6 chạy gates → B7 fix mọi finding xác nhận → B8 re-run gates.

## 4. Bản đồ thay đổi + luồng dữ liệu

| File | Dòng | Trách nhiệm |
|---|---|---|
| `market_data/stock_mgmt_native_views.py` | +124/−2 | `_compute_daily_weekly_cvd_series` `:1070`, localtime `:1095`, schema `cvd_series` `:287/:292`, whale_signals `price`+`ts` `:2246` |
| `market_serving/native_views.py` | +143 | `_WHALE_BUCKET_WINDOWS` `:474`, `build_whale_buckets()` `:492`, bulk price `:563`, `dominance neutral` `:573`, window canonical `:628-638` |
| `market_serving/session_facts_engine.py` | +9/−1 | `_SERIES_WINDOWS_BY_LABEL` +`4h`/`1D`, `_floor_bucket` hỗ trợ 4h/1D |
| `market_serving/views.py` | +8/−5 | `_WINDOW_TO_BUCKET_MINUTES` +`4h`/`1D`/`1d`, canonical window `:378-386` |
| `features/stock-detail/hooks/useStockDetailPageModel.js` | +30 | fetch dark-money `:171-200`, clear-on-symbol `:176` |
| `pages/StockDetailPage.tsx` | +45/−2 | override whale/CVD/dark-flow `:146-181`, **fix price close `:155`**, forward `:337-338` |
| `market_data/tests/test_whale_cvd_full_tf.py` | mới, 5 test | aggregate/side, fill rỗng, floor 500M, neutral, alias/invalid window |
| FE component tests | +3 test | dark-money fetch, clear-on-symbol, price=close |

**Trace**: `activeTimeframe ∈ {d,1d,1w}` → `useStockDetailPageModel.js:171-200` fetch dark-money → `StockDetailPage.tsx:146-181` override whale/CVD → `VNStockChartPanel.js:360-377` map → widget `whaleOrders`/`externalCvdSeries`. Whale bucket API: `/realtime/whale-feed/{symbol}/?window=1D` → `native_views.py:628-650` → `build_whale_buckets()` `:492`. CVD intraday: `/session-facts/{symbol}/cvd/?window=4h` → `views.py:378-386` → `session_facts_engine.py:_floor_bucket`.

**Quyết định contract (đã chốt)**: `1W` **không** dùng CVD endpoint (per-session không phù hợp) mà lấy `cvd_series` từ dark-money aggregate; `whale_buckets[]` là contract mới cho daily/weekly/4h, per-tick `whale_orders[]` chỉ cho intraday.

## 5. Findings của 2 subagent độc lập + trạng thái xử lý

### 5.1 BE auditor — 1 blocker P0, 2 major P1, 6 minor
| ID | Mức | file:line | Xử lý |
|---|---|---|---|
| F-01 | **P0** | `stock_mgmt_native_views.py:2246` | ✅ `timezone.utc` → `dt_timezone.utc` |
| F-02 | P1 | `native_views.py:628-638` | ✅ canonical `lower()` + alias `1d`/`1w` + `400 UNSUPPORTED_WINDOW` |
| F-03 | P1 | `stock_mgmt_native_views.py:1095` | ✅ `timezone.localtime(executed_at).date()` trước khi bucket |
| F-04 | P2 | `native_views.py:541-551` | ✅ bỏ query `executed_at__date__range` sai field, chỉ dùng `date__range`, thu hẹp `except DatabaseError` |
| F-05 | P2 | `native_views.py:494-496` | ✅ docstring cập nhật (bucket rỗng đã được fill) |
| F-06 | P2 | test file | ✅ thêm 2 test (floor 500M, empty bucket, alias/invalid window) |
| F-07 | P2 | `stock_mgmt_native_views.py:292` | ✅ thêm `cvd_series` vào `required` |
| F-08 | P2 | `native_views.py:560-565` | ✅ bulk `date__in` thay N+1 |
| F-09 | P2 | `native_views.py:573` | ✅ `net == 0` → `neutral` |

**Claims BE đã kiểm chứng**: `whale_buckets[]` trả đủ 7 field; CVD daily/weekly lọc `whale_tick:`, floor 500M, side strict, fill rỗng từ `DailyPrice`, trả `delta/cvd/unit`; weekly bucket dùng `max_date` khớp candle (`_aggregate_daily_rows`).

### 5.2 FE/docs auditor — 0 P0, 3 P1, 10 P2
| ID | Mức | file:line | Xử lý |
|---|---|---|---|
| F-01 | **P1** | `StockDetailPage.tsx:155` + `VNStockChartPanel.js:364` | ✅ `matched_value: s.price ?? …`; test assert `price`/`matched_value === 18200` |
| F-02 | P1 | 2 file component test | ✅ mock `getDarkMoneyHistory` + 3 test chạm path mới (16/16) |
| F-03 | P1 | `StockDetailPage.tsx:148` vs handoff `:107` | ⚠ **Đính chính tài liệu**: FE slice này dùng `whale_signals` (đã sửa price=close); chuyển sang `whale_buckets[]` là việc widget team (R-03/R-04). Không đổi FE vượt scope. |
| F-04 | P2 | `useStockDetailPageModel.js:176` | ✅ clear `darkMoneyData` ở đầu effect + test |
| F-05 | P2 | `VNStockChartPanel.js:52,524` | ⚠ **Residual ghi rõ**: `enableCVD` mặc định `false`, không caller truyền `true` ⇒ widget render CVD **CHƯA XÁC MINH**; bàn giao widget team (R-04). |
| F-06 | P2 | `native_views.py:494-496,542` | ✅ đã fix ở BE F-04/F-05 |
| F-07 | P2 | test file | ✅ đã fix ở BE F-06 |
| F-08 | P2 | handoff `:5,74,112-126` | ✅ cập nhật branch/commit/evidence/version/build |
| F-09 | P2 | audit `:3,34,51,71` | ✅ viết lại tài liệu này (bỏ dòng `VNStockChartPanel` sai, status nhất quán) |
| F-10 | P2 | ledger Entry 58 cuối file | ✅ Entry **640** đặt đầu file (sau rebase `origin/dev` Dev đã chiếm 637/639), xoá block lịch sử 1.054 dòng bị stage nhầm |
| F-11 | P2 | `package-lock.json` +77/−56 | ✅ revert về HEAD, không commit (deny-list) |
| F-12 | P2 | research/analysis | ✅ đánh dấu AS-IS trước slice |
| F-13 | P2 | gate self-reported | ✅ ghi rõ host + lệnh tái tạo ở §6; log đính kèm `docs/evidence/whale-cvd-full-tf/gates.md` |

## 6. Quality gates (coordinator tự chạy lại sau mọi fix)

| Gate | Lệnh | Kết quả |
|---|---|---|
| BE syntax | `python -m py_compile` 5 file | ✅ OK |
| BE tests | VPS `vninvest-core-api`, `CORE_DATABASE_URL` trỏ `vninvest-core-db:5432`, `manage.py test market_data.tests.test_whale_cvd_full_tf` + 4 regression, `--keepdb` | ✅ **Ran 9 tests / OK**; container đã restore (`build_whale_buckets` count=0, test file removed) |
| FE type | `npx tsc --noEmit` (`packages/web`) | ✅ 0 lỗi |
| FE unit | `npx vitest run src/features/stock-detail` | ✅ **16/16** (13 cũ + 3 mới) |
| FE build | `npm run build` | ✅ xem `docs/evidence/whale-cvd-full-tf/gates.md` |

## 7. Câu hỏi đã chốt / residual
1. ~~Chạy BE test trên staging VPS?~~ ✅ Đã chạy 9/9.
2. R-04 (CVD 4h FE wiring) → **widget team**, FE chỉ override `cvd_series` intraday/daily; `enableCVD` chưa bật ⇒ CHƯA XÁC MINH render.
3. R-03 (whale bucket `count=0` render) → **widget team**; BE đã fill bucket rỗng.

## 8. Đánh giá tổng thể
**AGREE với residual có kiểm soát.** Không còn P0/P1 mở trong repo `vninvest`; 9 BE test + 16 FE test xanh. Residual R-03/R-04 nằm hoàn toàn trong repo widget và đã có handoff riêng `docs/handoffs/HANDOFF_2026-11-25_WHALE_CVD_WIDGET.md`. Không migration DB. Người duyệt: Owner BE/Coordinator.
