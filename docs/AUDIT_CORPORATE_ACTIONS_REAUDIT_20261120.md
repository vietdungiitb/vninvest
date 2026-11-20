# AUDIT — Re-audit pipeline corporate actions + hướng xử lý tiếp theo (2026-11-20)

- **Scope**: toàn bộ pipeline corporate actions phía vninvest sau fix C-02 (PR #461) + tiến triển phía vnbroker sau audit PR #460.
- **Auditor**: độc lập, read-only với code (không sửa source); có chạy lại gate + test parser trên staging.
- **HEAD verified**: `dev@5ae5f24b6` (local == `origin/dev`, worktree sạch); branch làm việc `docs/reaudit-corp-actions-next`.
- **Nguồn đối chiếu**: `docs/PLAN_CORPORATE_ACTIONS_PIPELINE_20261120.md`, `docs/evidence/corporate-actions/PHASE0_AUDIT.md`, `docs/AUDIT_VNBROKER_PLAN_CRITIQUE_20261120.md` (Entry 571), ledger Entry 569/570/572, `vnbroker@main:6020aac` (3.8.0, read-only).

## TÓM TẮT 5 ĐIỂM QUAN TRỌNG NHẤT

1. **Pipeline vninvest ở trạng thái tốt, không blocker**: model + migration `0008` (do `makemigrations` sinh), parser/ingest/engine/sync/bars API sau flag, 62/62 test xanh có bằng chứng VPS, re-audit vòng 2 PASS 0 blocker/0 major, claim đã đóng, gates máy (`check-multi-agent`, `system-design --check`, `diff --check`) đều PASS trong phiên này.
2. **Fix C-02 verified tươi**: chạy lại `test_corporate_action_parser` trên staging với code HEAD → **7/7 OK**; ESOP `CBCNV 0.5%` ⇒ `unparsed + ambiguous_ratio_pct`, `Cổ phiếu thưởng 15%` / `Trả Cổ tức bằng Cổ phiếu 49.5%` vẫn parse, không regression.
3. **vnbroker đã triển khai cả 3 slice** (sau audit của ta): `3cfebb9` parser + `VCI.corporate_actions` (có ESOP guard), `78009ab` facade `Company.corporate_actions()` (failover + test), `c3c028e` docs/message TCBS trỏ `TCBS_JWT_TOKEN`. Rule ESOP **hội tụ** với phía ta (chỉ khác tên field: họ `is_esop`, ta `ambiguous_ratio_pct`).
4. **Version trap (C-01) vẫn mở**: `vnbroker` local ở **3.8.0** chưa release; vninvest pin **`vnbroker==3.7.2`** (`packages/core/backend/requirements.txt:38`). Code mới của họ chưa tới được consumer cho tới khi release + bump pin + re-probe.
5. **Còn 4 follow-up không chặn + 1 điều kiện bật flag**: (a) DIV có cả `%` lẫn tiền vẫn gán nhầm `stock_ratio_pct` (đã repro, chưa có title thực tế); (b) cờ `ambiguous_*` rớt ở ranh giới parser→DB; (c) bars W/M không kèm `adj_close`; (d) contract `ParsedAmount` trong plan chưa liệt kê `ambiguous_ratio_pct`. Flag `CORPORATE_ACTIONS_ENABLED` giữ `False` cho tới khi Q1/Q2 có đối chiếu độc lập.

## A. TRẠNG THÁI HIỆN TẠI (đã verify từng mục)

| # | Hạng mục | Bằng chứng | Trạng thái |
|---|---|---|---|
| A1 | Parser + ESOP guard | `packages/core/backend/src/market_data/corporate_actions/parser.py:13,27-32,73-76` (`BONUS_SHARE_HINTS`, `_fold`, `ambiguous_ratio_pct`); test `.../tests/test_corporate_action_parser.py:44-60` | ✅ Đóng C-02; 7/7 staging rerun phiên này |
| A2 | Ingest VCI trực tiếp + dedup + fallback | `.../corporate_actions/ingest.py:101-149` (gọi `VCICompany`, `source_event_id` từ `id`, fallback hash có amount/ratio, **không** chứa title), `normalize_provider_error:45-50` (F3 đã sửa) | ✅ F1/F3 đóng ở vòng 2 |
| A3 | Engine recompute + guard | `.../corporate_actions/adjustment.py:52-59` (xoá factor stale), `:81-96` (reset `adj_close`/`is_adjusted`, bỏ early-return); test recompute `.../tests/test_corporate_action_adjustment.py:96-114` | ✅ F1 đóng |
| A4 | Migration | `.../migrations/0008_dailyprice_adj_close_adjfactor_corporateaction.py` (dependency `0007`, `AddField` nullable + 2 `CreateModel` + 2 `UniqueConstraint`); `makemigrations --check` sạch ở vòng 2 | ✅ Rollback được |
| A5 | Task + beat + flag | `data_ingest/tasks.py:3483` (default `false`), `vninvest_core/settings.py:786-790` (beat 18:30), bars `stock_mgmt_native_views.py:4044-4060,4383-4400` (flag-gated, per-date PARTIAL) | ✅ Flag off; contract cũ giữ nguyên khi tắt |
| A6 | Tests | 62/62 xanh (Entry 572; auditor vòng 2 re-run cả 6 module) + 7/7 parser rerun phiên này | ✅ |
| A7 | Claims | `corporate-actions`, `corporate-actions-esop`, `corp-action-phase0-evidence` đều `done`; không còn `in-progress` nào giữ file pipeline | ✅ |
| A8 | Ledger | Entry 569 (Phase 0) → 570 (pipeline 60/60) → 571 (audit vnbroker) → 572 (fix C-02) — chuỗi liên tục, không thiếu số | ✅ |
| A9 | Mirror `main` | `origin/main` có handoff (`HANDOFF_2026-11-20...`, `PHASE0_AUDIT.md` tồn tại); code pipeline **chỉ trên `dev`** (đúng thiết kế — flag off, chưa deploy) | ✅ |
| A10 | Gates phiên này | `check-multi-agent` exit 0 (0 lỗi, 0 trùng migration); `system-design --check` SẠCH exit 0 (120 model / 139 migration / 1425 route khớp); `git diff --check` sạch | ✅ |

## B. FRESH EVIDENCE PHIÊN NÀY (lệnh tái tạo)

```bash
# Parser rerun trên staging với code HEAD (DB-free, SimpleTestCase)
tar -czf corp-src-reaudit.tar.gz -C packages/core/backend src
scp corp-src-reaudit.tar.gz root@14.225.255.47:/tmp/corp_reaudit_src.tar.gz
ssh root@14.225.255.47 "bash run-parser-reaudit.sh"
# → Ran 7 tests ... OK (FPT ESOP 0.5% unparsed+flag; cash 1,500/2.000 parse; ISS 15%/49.5% parse)
```

```bash
# Repro latent DIV+% (local, không cần DB)
python -c "from market_data.corporate_actions.parser import parse_event_title; ..."
# 'Trả cổ tức ... tỉ lệ 20% - 1,500 VND','DIV' ⇒ cash=1500, stock_ratio_pct=20 (SAI — xem F-NEW-1)
```

## C. FINDINGS MỚI (không có blocker/major)

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| F-NEW-1 | MED (pre-existing, watch) | `parser.py:68` (chỉ guard khi `cash is None`) | DIV có cả `%` và tiền ⇒ vẫn gán `stock_ratio_pct` (repro ở §B) | Nếu title thực tế dạng này xuất hiện, denominator sai | Guard `action_type != 'DIV'` cho ratio + 1 test; ticket riêng, không chặn |
| F-NEW-2 | MED (observability) | `ingest.py:132-148`, `models.py:100-129` | `ambiguous_ratio_pct`/`ambiguous_cash_pct` không được persist (không có field DB, row không truyền) | Không phân biệt ESOP vs thiếu dữ liệu ở API/DB; factor vẫn an toàn (dùng `parse_status`) | Đưa cờ vào row/model hoặc ghi rõ trong doc contract; ticket riêng |
| F-NEW-3 | LOW | `stock_mgmt_native_views.py:4064-4098` | `_aggregate_daily_to_ohlcv_bars` (W/M) không kèm `adj_close` dù flag bật (chỉ `_ohlcv_bar_from_daily:4049-4061` có) | Bars W/M im lặng mất adjustment | Quyết định: bổ sung `adj_close` cho bucket W/M hoặc document rõ "chỉ timeframe D" |
| F-NEW-4 | LOW (doc drift) | `docs/PLAN_CORPORATE_ACTIONS_PIPELINE_20261120.md:167` | Contract `ParsedAmount` chưa liệt kê `ambiguous_ratio_pct` | Plan lệch code | Cập nhật 1 dòng khi chạm plan lần tới |
| F-NEW-5 | LOW (cross-repo) | `vnbroker@main:6020aac:vnbroker/common/corporate_actions.py:56,108-114` vs `parser.py:18-24` | Cùng rule ESOP, khác tên field (`is_esop` vs `ambiguous_ratio_pct`) | Tích hợp tương lai cần mapping | Ghi vào contract mapping khi dùng `VCI.corporate_actions()`; không đổi code hiện tại |

## D. TIẾN TRIỂN PHÍA VNBROKER (verify read-only tại `D:\Mujoco Projects\vnbroker`)

| Commit | Nội dung | Đối chiếu audit ta |
|---|---|---|
| `3cfebb9` parser + `VCI.corporate_actions` (test golden VNM) | `common/corporate_actions.py:30` (`BONUS_MARKERS`), `:108` (ISS+% chỉ khi có marker và không ESOP) | Đóng C-02 phía họ; rule hội tụ với ta (khác tên field — xem F-NEW-5) |
| `78009ab` facade `Company.corporate_actions()` + test | `api/company.py` (+10 dòng, `@dynamic_method`), `tests/unit/api/test_corporate_actions_api.py` (contract columns, KBS raise) | Đóng Slice 2 + C-06 (fail loudly, không trả rỗng) |
| `c3c028e` docs/message TCBS auth | `IMPLEMENTATION_SUMMARY.md`, `MIGRATION_GUIDE.md`, `company.py` (message nhắc `TCBS_JWT_TOKEN`) | Đóng C-04 (cả 2 doc + message, không sót) |
| Chưa có | Release 3.8.x + consumer bump pin | **C-01 vẫn mở** — vninvest còn ở 3.7.2, chưa dùng được code mới |

## E. QUALITY GATES PHIÊN NÀY

| Gate | Kết quả |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | exit 0 — 0 lỗi, 0 trùng migration (cảnh báo CLAIMS stale pre-existing) |
| `node docs/system-design/_meta/tools/check-system-design.mjs --check` | SẠCH exit 0 — 120 model / 139 migration / 1425 route khớp |
| `git diff --check` + `git status` | Sạch |
| Parser rerun staging (code HEAD) | 7/7 OK (§B) |
| Full 62-test suite / BE suite / FE build / deploy | **CHƯA CHẠY** phiên này (dựa bằng chứng Entry 570/572 + auditor PASS; không suy diễn) |

## F. HƯỚNG XỬ LÝ TIẾP THEO (ưu tiên giảm dần, có owner)

1. **[P1 — trước khi bật flag] Đối chiếu độc lập Q1/Q2** (owner): xác nhận 950+1.500 cùng `2024-09-24` là 2 sự kiện thật (TCBS token staging hoặc disclosure HOSE/VSDC). Không có bước này ⇒ flag giữ `False`. VNM còn 2 cặp cùng ex_date khác (`2023-08-03`, `2025-10-16`) có thể dùng chéo.
2. **[P1 — track release] Theo dõi vnbroker release 3.8.x** (owner/package team): khi release, bump pin `requirements.txt:38` 3.7.2→3.8.x trong slice riêng, re-probe VCI (`from_date='20100101'`, kiểm `id` ổn định, enum `DIV,ISS`), rồi mới cân nhắc chuyển ingest sang `VCI.corporate_actions()` + mapping field (F-NEW-5).
3. **[P2 — ticket backend] Guard DIV+% (F-NEW-1)**: 1 test + 1 điều kiện trong `parse_event_title`; chạy regression 62+ test trên staging DB tạm; không cần migration.
4. **[P2 — ticket backend] Persist cờ ambiguous hoặc document (F-NEW-2)**: thêm field nullable + migration do `makemigrations` sinh, hoặc ghi rõ "flag chỉ tồn tại ở parser return" trong handoff §5.
5. **[P3] Quyết định W/M `adj_close` (F-NEW-3)** + cập nhật plan contract (F-NEW-4): 1 dòng doc + (nếu bổ sung) test bars W/M.
6. **[P3] TCBS cross-check**: khi có JWT thật, probe `dividends()` staging để đối chiếu VCB/DIV (Q4 còn mở từ handoff).
7. **Không làm**: bật flag khi chưa xong (1); tự tính `adj_close` trong package; sửa KBS mù; đụng `common/data.py` phía họ.

## G. KẾT LUẬN

Pipeline vninvest **đạt trạng thái mergeable/stable sau flag**: code đúng thiết kế đã audit, test xanh có bằng chứng, gates sạch, claim đóng, không nợ blocker/major. Re-audit này là doc-only (không đổi source). Việc còn lại nằm ở **quyết định dữ liệu** (Q1/Q2), **track release package** (C-01), và 4 ticket follow-up P2/P3 — tất cả đều không yêu cầu sửa kiến trúc.

**Lessons áp dụng**: `[L-002, L-M02, L-V01, L-V02, L-T01, L-T02]` — claim trước khi sửa; branch `docs/*` + agent trùng tên bỏ tiền tố; mọi số kèm lệnh; không đọc tiếng Việt qua console (dùng read tool); fail-before chạm hàm thật; `numstat` sau mỗi lần ghi.
