# B-1 — Mount 2 route realtime (whale-campaigns + unified-alerts) + trả lời Q-B1..Q-B4

> **Ngày:** 2026-11-12 · **Nhánh:** `feat/enterprise-b1-routes` (worktree riêng `vninvest-wt-b1`) · **Base:** `origin/dev` @ `ff0fd28ae` (PR #353 đã merge)
> **Bám theo:** `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md` §2 B-1 + §8 · **Đáp án 4 câu hỏi:** `docs/BACKEND_QA_ANSWERS_QB1_QB4_2026-11-12.md`
> **Lessons áp dụng:** [L-001 khai claim trước code] [L-002 branch riêng + PR] [L-B01 BE test cần Postgres, không ép SQLite] [L-B02 đúng thư mục test] [L-G01 rebase → chạy lại gate] [L-G02 không báo PASS cho thứ chưa chạy] [L-V01 script đo cần control] [L-V02 claim thừa kế cần phản chứng] [L-T01 line-ending] [L-T02 citation đúng file] [L-F04 không round-trip file bằng PowerShell]

## 1. Verify sự thật (đọc code thật, không tin claim của người khác)

| Claim (spec §2 B-1) | Verify | Kết quả |
|---|---|---|
| `RealtimeUnifiedAlertsView` ở `market_serving/native_views.py:540` | mở file | ✅ `:540` đúng; `get()` `:558`; 400 khi cursor sai `:573-578` |
| `RealtimeWhaleFeedAggregateView` (kế thừa unified-alerts) ở `:910` | mở file | ✅ `:910` đúng, extends `RealtimeUnifiedAlertsView` |
| `RealtimeWhaleCampaignsView` ở `:1371` | mở file | ✅ `:1371` đúng, extends `RealtimeWhaleFeedAggregateView` |
| `market_serving/urls.py` **không** mount 2 route này | đọc cả file (35 dòng) | ✅ đúng — 13 route, không có `unified-alerts`/`whale-campaigns` |
| AC: `/realtime/whale-campaigns/<symbol>/` | đọc `get()` của campaigns `:1374-1404` | ⚠️ **view KHÔNG dùng `kwargs['symbol']`** — nó gọi `_resolve_scope(request)` (`:1406`) ⇒ path symbol sẽ bị **bỏ qua**. Class cha (`RealtimeWhaleFeedAggregateView.get`) mới dùng `kwargs.get('symbol')` (`:944-950`) ⇒ phải bổ sung tương tự cho campaigns, nếu không URL có symbol là **vô nghĩa**. |
| AC: 400 có `code=invalid_query` | đọc 400 của 2 view | ⚠️ **chưa đạt**: `:571/574/576/578` + `:1393/1396/1400` trả **chỉ** `{'detail': ...}` ⇒ `code` là việc của **B-5** (envelope). Ghi rõ trong ledger, không đánh dấu AC sai. |

## 2. Kế hoạch (nhỏ, 3 file runtime + 1 file test)

1. `market_serving/urls.py` — import 2 view + mount:
   - `realtime/unified-alerts/` → `RealtimeUnifiedAlertsView` (scope theo query: `scope`/`symbols`/`watchlist_group_ids` — xem `:1054-1082`).
   - `realtime/whale-campaigns/<str:symbol>/` → `RealtimeWhaleCampaignsView` (path symbol phải **có tác dụng**).
2. `market_serving/native_views.py` — `RealtimeWhaleCampaignsView.get()`: ưu tiên `kwargs['symbol']` (mirror `:944-950` của class cha) ⇒ `symbols=[symbol.upper()]`, `scope='custom'`, `scope_source='kwarg'`. **Additive**: view này hiện **không** được route nào gọi ⇒ không đổi hành vi client nào.
3. Test `market_serving/tests/test_native_views.py` — thêm `RealtimeCampaignRoutesTest`:
   - `reverse('market_serving:realtime-unified-alerts')` → `/core/v1/realtime/unified-alerts/`.
   - `reverse('market_serving:realtime-whale-campaigns', kwargs={'symbol':'VCI'})` → `/core/v1/realtime/whale-campaigns/VCI/`.
   - campaigns theo symbol → 200 + `results` chỉ chứa symbol đó (tạo `UnifiedAlert` + `WhaleAlertCanonical` như pattern test hiện có `:167-190`).
   - unified-alerts → 200 + envelope có `results`/`has_more`/`next_cursor`.
4. Docs: đáp án Q-B1..Q-B4 (file cùng slice) + ledger Entry 466 + claim `enterprise-b1-routes`.

## 3. TDD fail-before (bắt buộc)

- Viết test **trước** code ⇒ chạy trên VPS (`manage.py test market_serving.tests.test_native_views`) ⇒ **ĐỎ** (`NoReverseMatch` vì route chưa mount) ⇒ ghi lệnh + output vào đây.
- Sau khi mount ⇒ **XANH** (lệnh + output).

## 4. Gates (chạy thật, không báo PASS cho thứ chưa chạy)

- **BE test (VPS, runbook §12.3)**: `manage.py test market_serving.tests.test_native_views` trong container `vninvest-core-api:staging` + DB tạm riêng, volume mount code nhánh; **DROP DB tạm sau khi chạy** (bắt buộc).
- `manage.py check` + `makemigrations --check --dry-run` (được chạy local — runbook §12.2) ⇒ không migration mới.
- `node packages/web/scripts/check-multi-agent.mjs` ⇒ 0 lỗi; `node docs/audit-uiux/scripts/check-ledger-entry.mjs` ⇒ **FAIL do 1 trùng PRE-EXISTING trên `origin/dev`** (Entry 386 ×2: VNBroker + PR #353; Entry 466 của slice xuất hiện 1 lần) — ghi trung thực, không sửa baseline của gate khi chưa có quyết định coordinator.
- **CHƯA CHẠY**: E2E staging (đo ngoài theo Rule 17 — phía widget team), `spectacular` (không đổi serializer ⇒ không cần), full BE suite.

## 6. Kết quả thực hiện (ghi sau khi chạy)

- **TDD fail-before (VPS, DB tạm `b1_demo`)**: `manage.py test market_serving.tests.test_native_views` ⇒ 12 test, **5 mới ĐỎ** (`NoReverseMatch: 'realtime-whale-campaigns'` + 404) ⇒ đúng dự đoán (route chưa mount).
- **Sau code**: 12/12 OK · suite app `market_serving` 31/31 OK · `manage.py check` no issues · `makemigrations --check --dry-run` còn `commercial/0008_licensekey` (**pre-existing**, branch không đụng file commercial nào ⇒ **không** tạo migration).
- **B8 (tự audit, PASS)**: prefix `/core/v1/` đúng (`vninvest_core/urls.py:61`); gating `IsAuthenticated` kế thừa (`native_views.py:543`); diff urls.py chỉ thêm; không client cũ gọi 2 route mới; test assert giá trị thật + case âm; AC `code=invalid_query` **chưa đạt** (400 chỉ có `detail`) ⇒ để B-5.
- **Dọn VPS (bắt buộc)**: DROP DATABASE `b1_demo` + `git worktree remove --force /tmp/wt-b1` + `prune` — **đã chạy**: `DROP DATABASE` OK · worktree list chỉ còn `/opt/vninvest`.

## 5. Rủi ro

- **Rủi ro chính**: thêm route là **mở thêm bề mặt API** ⇒ phải kẹp `permission_classes` (đã có `IsAuthenticated` ở `:543`) + quota theo plan (đã dùng chung middleware) + không đụng route cũ.
- Rủi ro contract: widget gọi `/whale-campaigns/<symbol>/` — nếu view bỏ qua symbol thì widget nhận campaigns sai scope ⇒ đã xử lý bằng (2).
- Rủi ro môi trường: BE test chỉ chạy được trên VPS (RAM local) — theo runbook §12.
