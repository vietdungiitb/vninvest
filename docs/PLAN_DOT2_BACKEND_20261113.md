# PLAN — Đợt 2 backend: merge w0-6 round-2 + S1.1 B-5 + S2.1 B-2 + S3.1 nhánh B — rev 1

> **Ngày:** 2026-11-13 · **Trạng thái:** KẾ HOẠCH rev 1 — chờ audit B3
> **Claim:** `dot2-backend-20261113` (`docs/CLAIMS.md`, appended, `in-progress`, commit `252358b36`)
> **Branch:** `feat/dot2-backend-20261113` → `dev` (PR) · **Worktree:** `D:/Mujoco Projects/vninvest-wt-dot2`
> **Base đo:** `origin/dev` @ `c57f2f150` (PR #374 closeout-dot1 đã merge)
> **Nguồn:** `docs/PLAN_REMAINING_WORK_20261113.md` §4–§5 + probe QB2/QB4 (`docs/evidence/closeout-dot1-20261113/qb2-probe.md`, `qb4-probe.md`)
> **Thẩm quyền:** Owner trao toàn quyền (1 mình 1 chợ — không còn agent nào khác):
> D1=(b) FINAL · D2=breaking `price` string→number FINAL ngay (FE đã `Number()`-hóa 199 chỗ + `chartAdapter.js:42-46`; consumer ngoài đọc qua adapter đã normalize; không còn widget-team ngoài nào để chờ) · D3=400 UPPER_SNAKE · D4=defer sang S3.2 · D7=token revoked (ghi nhận) · D8=B-trước-C.
> **Lessons áp dụng:** [L-001, L-002, L-003, L-007, L-G01, L-G02, L-V02, L-T01, L-F07, L-S01]
> **Audit độc lập (B3, subagent read-only):** CHƯA CHẠY (sẽ ghi vào `docs/evidence/dot2-backend-20261113/audit.md`)

---

## 0. Kết luận 1 trang

1. **P1 — Round-2 `w0-6` đã xử lý XONG (không merge — verify-equivalence + xóa branch stale).** Kiểm chứng: `dev` đã chứa toàn bộ substance (Entry 398 trong ledger dev, `build_usage_meters`/`send_email` thật/`completed`/data_quality trong code dev, `test_w0_6_data_honesty.py` 178 dòng trong dev); diff hai chiều `dev ↔ branch-tip` chỉ còn formatting/comment (`import` style, `noqa`, blank line) + test import order — **0 logic mới**. Merge sẽ chỉ gây ồn + conflict giả. Hành động (toàn quyền, solo): `git merge --abort`, `git push origin --delete feat/w0-6-data-honesty`, xóa 2 branch stale 0-unmerged (`feat/backend-enterprise-demo-spec-20261112`, `feat/remaining-work-plan-20261113`, local). `native_views.py`/`stock_mgmt_native_views.py` hết người giữ → hết chặn S1.1/S2.1. Bằng chứng: `git diff -w dev <tip> --stat` + `git show dev:...` trong evidence §P1.
2. **P2 — S1.1 B-5:** `price`/`current_price`/`prev_price`/`price_change*`/`ceiling`/`floor`/`high`/`low`/`open`/`reference_price` string → JSON number ở quote đơn (`:67-81`) + price-board (`:267-268`, `RealtimePriceBoardView`) + batch (`:125-144`) + profile (`:376`). `change_pct` đã float, `volume` đã int — giữ. `None` giữ `null` (không `""`). Test hiện có (`test_native_views.py:68,71` assert float trades) cùng hướng — không ngược.
3. **P3 — S2.1 B-2 (D1b):** depth-chart bỏ sinh số giả (`pseudo_random`, `seed_hash`, `tick_size` loop `:456-511`): trả `bids: []`, `asks: []`, `spread: null`, `data_quality: 'unavailable'`, `note: 'orderbook_not_available'` (giữ `timestamp`). Xóa `is_mock`/`synthetic_from_snapshot` ở cả 2 nhánh (`:451-453`, `:522-524`). FE `StockOrderBookWidget.jsx:65,153,164,168`: badge ưu tiên `data_quality==='unavailable'` trước, giữ `is_mock` làm fallback chuyển tiếp; spread hiển thị `—` khi không phải number (guard `typeof`, vì `?? 0` + `!== undefined` hiện tại sẽ render "0.00" bịa cho book unavailable). Update test estimated (badge still shows, khác trigger).
4. **P4 — S3.1 nhánh B** (probe QB2 đã chốt: events rỗng thật): bars response thêm `adjusted: false` + `note` (không bịa `adj_close`). Tìm đúng vị trí serialize bars khi code (grep `adjusted` = 0 hit → thêm mới).
- **Defer (không trong slice):** S2.2 B-4, S3.2 B-6, S4.x C2/C3/E2E/deploy — slice riêng sau.

## 1. Baseline đo được (2026-11-13, worktree dot2 @ `c57f2f150`)

| # | Lệnh | Exit | Kết quả |
|---|---|---|---|
| B-1 | `check-multi-agent` | 0 | 0 lỗi (166 warning noise cũ) |
| B-3 | `check-ledger-entry` | 0 | 90 header / 89 distinct / max 477 |
| B-4 | `check-lessons` | 0 | 59/60 |
| B-5 | `normalize-eol` | 0 | OK |
| B-2/B-6/B-7/B-8/B-9 | secrets/light/i18n/page-registry/tsc | 0 | như closeout (code chưa đổi) |
| B-12 | `rev-list dev..origin/feat/w0-6-data-honesty` | — | 6 (sẽ merge ở P1) |

**Fail-before (chạy trước code, trên VPS):** BE `test_w0_6_data_honesty` trên code P1 (xanh kỳ vọng — regression guard) · test contract mới S1.1/S2.1/S3.1B viết trước → đỏ trên code chưa sửa → pass-after sau sửa. FE `StockOrderBookWidget.estimated` chạy trên VPS (§12.4) trước/sau.

## 2. Scope (file được chạm)

| File | P |
|---|---|
| `packages/core/backend/src/market_serving/native_views.py` (merge w0-6 + S1.1 + S2.1) | P1/P2/P3 |
| `packages/core/backend/src/commercial/tasks.py`, `identity_access/views_tenant.py`, `service_ops/views/signals.py`, `signal_intelligence/outbound_notification_service.py` (từ merge w0-6 — KHÔNG sửa thêm) | P1 |
| `packages/core/backend/tests/test_w0_6_data_honesty.py` + `src/market_serving/tests/test_native_views.py` + `packages/core/backend/tests/test_workstation_endpoints.py` (update theo contract mới) + test contract mới S1.1/S2.1/S3.1B | P2/P3/P4 |
| `packages/core/backend/src/market_data/stock_mgmt_native_views.py` (S1.1 chart/bars number + S3.1B adjusted/note) | P2/P4 |
| `packages/web/src/components/workstation/StockOrderBookWidget.jsx` + `StockOrderBookWidget.estimated.component.test.tsx` | P3 |
| `docs/PLAN_DOT2_BACKEND_20261113.md`, `docs/evidence/dot2-backend-20261113/*`, `docs/handoffs/HANDOFF_2026-11-13_DOT2-BACKEND.md`, `docs/CLAIMS.md`, ledger Entry 478 | S-C6 |

**KHÔNG chạm:** deny-list · migration tự sinh (chỉ khi cần — dự kiến 0) · `adapters/core/market.js` (đã Number-safe) · untracked của session khác.

## 3. AC (Given/When/Then)

- **AC-P1:** Given merge 6 commit w0-6, When chạy BE `test_w0_6_data_honesty` trên VPS DB tạm, Then xanh (kế thừa), và `git diff --name-only` không mất file nào của họ.
- **AC-P2:** Given quote/batch/bars, When `typeof body.price === 'number'`, `Number.isInteger(timestamp)`, `prev_price === null` khi thiếu (không `""`), Then contract test xanh; FE `Number()`-safe (không sửa FE).
- **AC-P3:** Given depth-chart, When response **không** chứa `is_mock`/`synthetic_from_snapshot`/`pseudo`, Then `bids == []` + `data_quality == 'unavailable'` + note; FE badge hiện khi unavailable (ưu tiên `data_quality`, fallback `is_mock`), spread hiển thị `—` khi không phải number (không crash, không bịa `0.00`).
- **Điều kiện V1 (audit B3):** trước merge grep `\.trim\(\)`/`\.split(`/`PropTypes.string`/`toFixed` trên consumer của 2 endpoint quote + chạy contract test fail-before/after đúng §B-fail-before.
- **AC-P4:** Given bars, When corporate actions không có nguồn, Then `adjusted === false` + `note` (không `adj_close` bịa).

## 4. Rollback / Non-goals / Limit

- Rollback: revert theo PR (P1 merge riêng commit merge nên revert được độc lập).
- Non-goals: B-4, B-6, C2/C3, E2E, deploy staging, purge history.
- Limit: 3 vòng/bước; P1 merge trước P2–P4 (hết chặn mới code).

## 5. DoD checklist

- [ ] Claim in-progress trước dòng code đầu tiên (có: `252358b36`)
- [ ] P1: verify-equivalence + delete stale w0-6 branch (done, thay cho merge — dev đã có substance) + Gates + BE w0-6 xanh VPS (kế thừa, 26/26) + gates local xanh
- [ ] P2–P4: fail-before đỏ → pass-after xanh (VPS), số test không giảm
- [ ] `makemigrations --check` không đổi · `spectacular` 0 warning mới
- [ ] FE widget test xanh VPS · tsc/eslint 0 error
- [ ] Ledger 1 Entry (478) + claim done + handoff + PR merge-commit + cleanup
