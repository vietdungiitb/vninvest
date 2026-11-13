# Re-audit FINAL (B8) — slice `dot2-backend-20261113` — `PASS`

> **Ngày:** 2026-11-13 · **Auditor:** subagent độc lập (read-only, chỉ tạo file này)
> **Worktree:** `D:/Mujoco Projects/vninvest-wt-dot2` · **Branch:** `feat/dot2-backend-20261113`
> **HEAD:** `00477653f31fab35b9aeaf77d3e5423f34a820e1`
> **Kết luận 1 đoạn:** Code đúng plan rev hiện hành, mock depth đã xóa sạch, `_num` + permission còn nguyên,
> 7/7 gate local exit 0, plan rev nhất quán ở mọi điểm operative (P1 correction, R1/R2, V1–V3).
> **PASS — sẵn sàng commit ledger Entry 478 + handoff + PR.** 3 quan sát không chặn ở §5.

## 1. Diff scope (`git diff --name-only origin/dev...HEAD`) — 10 file, đúng phạm vi

| File | Nhóm | Nhận xét |
|---|---|---|
| `docs/CLAIMS.md` | claim | +1 row `dot2-backend-20261113` in-progress (xem §5-OBS1 về wording) |
| `docs/PLAN_DOT2_BACKEND_20261113.md` | plan | rev hiện hành (P1 correction + R1/R2/V1–V3) |
| `docs/evidence/dot2-backend-20261113/audit.md` | evidence | audit B3 độc lập |
| `packages/core/backend/src/market_serving/native_views.py` | BE src | P2 `_num` + P3 honest-empty depth |
| `packages/core/backend/src/market_data/stock_mgmt_native_views.py` | BE src | P4 `adjusted:false` + `note` |
| `packages/core/backend/src/market_serving/tests/test_dot2_honest_contract.py` | test mới | 5 contract test S1.1/S2.1/S3.1B |
| `packages/core/backend/tests/test_w0_6_data_honesty.py` | test update | depth `unavailable` thay `estimated` |
| `packages/core/backend/tests/test_workstation_endpoints.py` | test update | honest-empty + anti-mock guard |
| `packages/web/src/components/workstation/StockOrderBookWidget.jsx` | widget | badge unavailable + spread guard |
| `packages/web/src/components/workstation/StockOrderBookWidget.estimated.component.test.tsx` | widget test | DOM-class asserts, không hardcode VI |

- **Deny-list:** scan diff-name theo pattern
  `migration|package-lock|package.json|pyproject|requirements|docker-compose|\.env|AGENTS.md` → **0 hit**. ✔
- **Migrations:** 0 file migration trong diff; `git status --porcelain -- docs/` sạch (ledger/handoff/PR là bước tiếp theo, chưa viết — đúng thứ tự). ✔

## 2. Xóa mock trong `native_views.py` — đạt, có 1 ngoại lệ giải trình được

- Grep toàn `src/market_serving/` với `is_mock|synthetic_from_snapshot|pseudo_random|_get_tick_size` → **0 hit trong src**
  (2 hit duy nhất nằm trong `tests/test_dot2_honest_contract.py:89-90` và
  `tests/test_workstation_endpoints.py` — là **assertions `assertNotIn`**, tức hàng rào chống mock quay lại). ✔
- Grep `hashlib` trong `native_views.py` → còn 2 hit: `:12` (import) và `:1695`
  (`campaign_id = f"camp:{hashlib.md5(campaign_seed...` trong whale-campaign clustering).
  Đây là code **pre-existing, ngoài scope slice** (deterministic campaign ID, không phải sinh giá giả);
  `import hashlib` inline + `seed_hash`/`pseudo_random` của depth mock đã bị xóa cùng diff
  (`git diff origin/dev...HEAD -- .../market_serving/native_views.py` hiện rõ khối mock `:456-511` cũ bị thay bằng return rỗng). ✔ **Không vi phạm.**
- `_num` còn nguyên tại `native_views.py:33-37` (`None` → `None`, không `""`); quote đơn `:74-81`,
  batch `:133-144`, price-board `:271-275`, profile `:380` đều đã `_num`-hóa. ✔
- Permission trên depth view còn nguyên: `RealtimeDepthChartView` tại `:436`,
  `permission_classes = [permissions.IsAuthenticated]` tại `:442`; `symbol.upper()` tại `:445`. ✔
- Depth response hiện tại (`:444-454`): `bids: []`, `asks: []`, `spread: None`,
  `data_quality: 'unavailable'`, `note: 'orderbook_not_available'` + `timestamp`. ✔
- P4 branch-B: `stock_mgmt_native_views.py` diff chỉ thêm `adjusted: False` + `note` (không `adj_close` bịa). ✔
- Widget: badge ưu tiên `data_quality === "unavailable"` trước, `is_mock` fallback
  (`StockOrderBookWidget.jsx:153,158,163-165`); spread guard `typeof orderBook.spread === "number"` tại `:168`
  ẩn cả dòng spread khi `null` (local `spread = orderBook?.spread ?? 0` tại `:65` còn đó nhưng không render —
  đủ, không cần refactor thêm). ✔

## 3. Gates — 7/7 exit 0 (auditor tự chạy lại trên worktree này)

| # | Lệnh | Exit | Kết quả |
|---|---|---|---|
| G1 | `node packages/web/scripts/check-multi-agent.mjs` | 0 | 0 lỗi; 166 warning = noise cũ, khớp baseline plan B-1 |
| G2 | `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | 0 | 90 header / 89 distinct / max 477 |
| G3 | `node scripts/check-lessons.mjs` | 0 | 59/60, sạch |
| G4 | `node scripts/normalize-eol.mjs` | 0 | 0 file đổi |
| G5 | `node packages/web/scripts/scan-secrets.mjs` | 0 | 4672 tracked, no secrets |
| G6 | `node packages/web/scripts/check-i18n-hardcoded-scope.mjs --all` | 0 | 309/309 = baseline, widget test không hardcode VI ✔ |
| G7 | `node packages/web/scripts/check-page-registry.mjs` | 0 | 21 entry, 26 route, 0 che |

Kết quả executor báo trên VPS (**executor-reported, auditor KHÔNG verify lại theo yêu cầu**):
BE contract 5/5 · workstation + w0_6 26/26 · market 90/90 · widget 3/3 · tsc 0 · eslint 0.

## 4. Plan rev consistency — operative đầy đủ, dư 2 vệt wording cũ (không chặn)

- **P1 correction CÓ** tại plan `§0-mục 1` (commit `5960cba9b`): "không merge — verify-equivalence + xóa branch stale",
  và branch `origin/feat/w0-6-data-honesty` đã **xóa thật** (`git ls-remote` rỗng). ✔
- **R1 fixed:** scope `§2` ghi đúng `src/market_serving/tests/test_native_views.py`. ✔
- **R2 fixed:** `§0-mục 2` ghi đúng "quote đơn `:67-81` + price-board `:267-268` + batch `:125-144` + profile `:376`". ✔
- **V1 addressed:** AC có "Điều kiện V1 (audit B3)" (`§3`, plan line 54). ✔
- **V2 addressed:** commit `00477653f` spread guard + test "no spread for empty honest book". ✔
- **V3 addressed:** badge ưu tiên `unavailable` + fallback `is_mock` (code `:153` + test fallback case). ✔

## 5. Quan sát không chặn (không phải objection, xử lý khi tiện)

- **OBS1 — Vệt wording "merge" cũ còn sót:** plan `§3` AC-P1 ("Given merge 6 commit w0-6"),
  `§4` ("P1 merge riêng commit merge", "P1 merge trước P2–P4"), `§5` DoD ("P1: merge + ..."),
  baseline B-12 ("sẽ merge ở P1"), và claim row (`CLAIMS.md` dòng mới: "P1 merge round-2 w0-6").
  Operative (`§0-mục 1`) đã đúng; các vệt này là doc-staleness, không ảnh hưởng code. Đề xuất: sửa 1 từ trong lúc
  viết handoff/ledger, hoặc để nguyên vì lịch sử claim append-only (KHÔNG sửa dòng claim cũ).
- **OBS2 — Branch stale còn 1:** `origin/feat/backend-enterprise-demo-spec-20261112` vẫn tồn tại
  (plan P1 định xóa; chỉ `feat/w0-6-data-honesty` — cái bắt buộc — đã xóa). Dọn khi tiện, không chặn PR.
- **OBS3 — `hashlib` còn lại** đã giải trình ở §2 (whale-campaign, ngoài scope). Không hành động.

## 6. Đề xuất bước tiếp (cho executor, ngoài phạm vi auditor)

1. Append ledger Entry 478 + 1 dòng index (đánh số kế tiếp, không sửa Entry cũ).
2. Claim `done` (append dòng mới theo protocol, không sửa dòng in-progress).
3. Viết `docs/handoffs/HANDOFF_2026-11-13_DOT2-BACKEND.md`.
4. Push + PR `feat/dot2-backend-20261113` → `dev`; cleanup worktree sau merge.
