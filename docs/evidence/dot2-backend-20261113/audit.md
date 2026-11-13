# Audit độc lập — `docs/PLAN_DOT2_BACKEND_20261113.md` rev 1 (B3)

> **Ngày:** 2026-11-13 · **Auditor:** subagent read-only · **Worktree:** `D:/Mujoco Projects/vninvest-wt-dot2` · **Branch:** `feat/dot2-backend-20261113`
> **Kết luận 1 đoạn:** Plan đúng hướng, bằng chứng probe đủ để chốt nhánh B, không chạm deny-list, AC kiểm được. **NEED_REVISION — 2 mục bắt buộc** (sai đường dẫn test + gán nhãn sai block `:267-268`), còn lại là reservation coder xử lý khi code. Chi tiết §1–§7.

## 1. Xác minh claim + base + file:line

- **Claim row tồn tại, in-progress:** `docs/CLAIMS.md:1938` — `| dot2-backend-20261113 | feat/dot2-backend-20261113 -> dev | ... | in-progress | 2026-11-13 | ...` ✔ (xác minh bằng `Get-Content` + split `|`, cột status = `in-progress`).
- **Branch hiện tại:** `feat/dot2-backend-20261113`, HEAD `252358b369f4e634e4324cfb0aa9cdce821f7ece` = đúng commit claim `252358b36` plan nêu ✔.
- **Base:** `merge-base HEAD origin/dev` = `c57f2f15026669eb790f792a3a27bcc077722d6e` = đúng `origin/dev @ c57f2f150` (PR #374 closeout-dot1) plan nêu ✔. Baseline đo trên đúng base.
- **Round-2 w0-6:** `rev-list --count origin/dev..origin/feat/w0-6-data-honesty` = **6** ✔ khớp plan §B-12. File thay đổi (diff `origin/dev...origin/feat/w0-6-data-honesty`): `commercial/tasks.py`, `identity_access/views_tenant.py`, `market_serving/native_views.py`, `service_ops/views/signals.py`, `signal_intelligence/outbound_notification_service.py` + 3 test (`test_soc_api_signals.py`, `test_commercial_tasks.py`, `test_w0_6_data_honesty.py`, `test_workstation_endpoints.py`) + docs/plan/ledger/CLAIMS — khớp scope P1 (plan liệt kê 4 file src + test, chỉ thiếu 2 file test phụ `test_soc_api_signals.py`, `test_commercial_tasks.py`, đi theo merge tự động, không cần sửa thêm) ✔.
- **Claim w0-6 gốc đã done:** `docs/CLAIMS.md:1791` status `done` (PR #280 merged) ✔ — 6 commit round-2 là việc mới trên cùng branch, merge chỉ mang 6 commit mới (phần đã merge là ancestor). Plan ghi "claim done ở `:1791`" ✔ chính xác.
- **Không còn agent nào giữ file scope:** `vet-finish :1879` (giữ `native_views.py` + `stock_mgmt_native_views.py`) đã release stale ở `:1935`; `chart-widget-team :40` released ở `:1936`; `pm-review-20261113` rows released ở `:1937`; `w0-6 :1791` done. Claim duy nhất `in-progress` trên 2 file BE là `dot2-backend-20261113 :1938` ✔. Solo đúng như plan nói ("1 mình 1 chợ").
- **Cited file:lines tồn tại:**
  - `native_views.py:67-81` ✔ (return block quote đơn, `price: str(...)`).
  - `native_views.py:125-144` ✔ (batch `RealtimeTickerListView`, `price: str(...)`).
  - `native_views.py:451-453` ✔ (`is_mock/data_quality/source` nhánh no-snap) và `:522-524` ✔ (nhánh chính).
  - `native_views.py:456-511` ✔ (`tick_size`, `seed_hash`, `pseudo_random`, loop bids/asks).
  - `StockOrderBookWidget.jsx:65` ✔ (`spread ?? 0`), `:153` ✔ (badge `is_mock`), `:164` ✔ (`spread !== undefined`).
  - `test_w0_6_data_honesty.py` ✔ (`packages/core/backend/tests/`), `test_workstation_endpoints.py` ✔ (cùng dir).
  - `test_native_views.py:68,71` — **nội dung đúng** (`:68 price 18.25 float`, `:71 price 18.2 float`) nhưng **SAI ĐƯỜNG DẪN** (xem §2-R1): file thật ở `src/market_serving/tests/`, không phải `packages/core/backend/tests/`.

## 2. NEED_REVISION (bắt buộc sửa trong plan trước khi code)

- **R1 — Sai đường dẫn test trong bảng Scope (§2):** plan ghi `packages/core/backend/tests/test_w0_6_data_honesty.py + test_native_views.py + test_workstation_endpoints.py`. Hai file đầu/cuối đúng ở `tests/`, nhưng `test_native_views.py` thật nằm ở `packages/core/backend/src/market_serving/tests/test_native_views.py` (glob xác nhận; `packages/core/backend/tests/test_native_views.py` **KHÔNG TỒN TẠI**). Nguy cơ thật: coder làm theo plan tạo nhầm file test trùng tên ở `tests/` (repo từng có sự cố layout test flat-vs-package). **Fix:** sửa scope thành đường dẫn đầy đủ `src/market_serving/tests/test_native_views.py`.
- **R2 — Gán nhãn sai block `:267-268` (§0-mục 2 + §2):** plan viết "batch/bars (`:267-268`, `:376`)". Thực tế `:253-276` là `class RealtimePriceBoardView` ("GET /api/realtime/price-board/`<symbol>/`") — **detail đơn mã, không phải batch/bars**. Batch thật là `:125-144`; `:376` là profile (`price: str(snap.price)`) ✔ đúng. **Fix:** đổi P2 thành "quote đơn `:67-81` + price-board `:267-268` + batch `:125-144` + profile `:376`", hoặc bỏ `:267-268` khỏi nhóm "batch/bars".

## 3. Reservation (không chặn, coder xử lý khi code)

- **V1 — D2-final risk CHẤP NHẬN ĐƯỢC có điều kiện:** `chartAdapter.js:42-46` normalize `Number()` cho bars ✔, `Number(` có 100+ hit FE ✔, widget đã `Number(volume)` ở `:69,79-80,89` ✔ — nhưng `adapters/core/market.js:9-19,354-356` (`getRealtimeTicker(s)`, `getRealtimeDepthChart`) **pass-through raw, không normalize**. Khẳng định plan "consumer ngoài đọc qua adapter đã normalize" chỉ đúng cho bars. Breaking string→number làm hỏng string-ops (`trim/split/concat`, `PropTypes.string`, snapshot), không hỏng `Number()`/số học. Solo + fail-before contract test + FE `Number()`-hóa rộng ⇒ risk thấp. **Điều kiện:** trước merge grep `\.trim\(\)\|\.split\|PropTypes\.string\|toFixed` trên các consumer của 2 endpoint quote + chạy contract test fail-before/after đúng như §B-fail-before.
- **V2 — Spread `null` hiển thị `0.00`:** AC-P3 cho `spread: null`, nhưng widget `spread = orderBook?.spread ?? 0` (`:65`) rồi `spread.toFixed(2)` (`:168`) — không crash nhưng render "Spread: 0.00", là số bịa mới cho book unavailable (đi ngược tinh thần data-honesty của chính slice). **Đề xuất:** khi `data_quality==='unavailable'` hiển thị `—` thay vì `0.00`, và guard `typeof spread === 'number'`.
- **V3 — P3 badge chuyển trigger:** giữ `is_mock` làm fallback chuyển tiếp là hợp lý (widget ngoài + test cũ còn dùng), nhưng AC nên ghi rõ thứ tự ưu tiên `data_quality==='unavailable'` trước, `is_mock` sau — tránh coder xóa nhầm nhánh fallback.
- **V4 — P1 merge mang theo docs w0-6:** merge branch round-2 cũng mang `IMPLEMENTATION_PLAN_W0_6_DATA_HONESTY_20261022.md` + ledger Entry 398 + claim rows vào branch slice (harmless, đã từng merge 1 lần ở PR #280 nên chỉ là fast-forward nội dung cũ). Ghi chú trong PR để reviewer không bất ngờ với diff docs.
- **V5 — `stock_mgmt_native_views.py` đã number sẵn nhiều chỗ** (`_to_float`, `_serialize_price_point :941-946`, schema `type:number :100-106`): phần "chart/bars number" của P2 có thể đã xong một nửa — fail-before test sẽ lộ ra; coder verify rồi mới sửa, không sửa mù.

## 4. Checklist audit (a)–(f)

- **(a) P1 merge sane:** ✔ merge (giữ authorship 6 commit), verify Gates + BE test w0-6 trên VPS rồi mới PR chung; revert được độc lập bằng revert merge-commit. Solo nên không có race.
- **(b) D2-final acceptable:** ✔ có điều kiện (V1).
- **(c) Scope không deny-list:** ✔ AGENT_PROTOCOL §2 (5 nhóm: `AGENTS.md`, `package.json`, lockfiles, `docker-compose*.yml`/`.env*`). Scope chỉ có BE src + test + widget + docs/CLAIMS/ledger (ledger đã gỡ khỏi deny-list 2026-10-03). Migration "chỉ khi `makemigrations` sinh" ✔ đúng protocol.
- **(d) AC testable:** ✔ cả 4 AC đều có assertion cụ thể (`typeof`, `bids == []`, `adjusted === false`, `git diff --name-only`, số test không giảm).
- **(e) Lessons khớp tags:** ✔ cả 10 ID tồn tại trong `docs/LESSONS/INDEX.md`: `L-001/L-002/L-003/L-007` (multi-agent), `L-G01/L-G02` (build-gates), `L-V02` (verification), `L-T01/L-F07` (tooling-traps), `L-S01` (security). Phủ đúng tags task (claim/merge/worktree/gate/BE-test/FE/verify).
- **(f) S3.1-nhánh-B nhất quán probe:** ✔ `qb2-probe.md` — `Company.events()` trả DataFrame rỗng `shape=(0,0)`, không exception, trong khi overview/officers/shareholders đầy đủ (nguồn tới được ⇒ rỗng là thật). Nhánh B (`adjusted:false` + note, không bịa `adj_close`) là kết luận đúng. `qb4-probe.md` (5M rows/1377 mã, tape tới hôm nay) hậu thuẫn E4-polling, không mâu thuẫn slice này.

## 5. CONTRADICTIONS plan↔code

| # | Plan | Thực tế | Tác động |
|---|---|---|---|
| C1 | Scope: `test_native_views.py` ở `packages/core/backend/tests/` | File ở `src/market_serving/tests/test_native_views.py`; path plan **KHÔNG TỒN TẠI** | R1 — nguy cơ tạo nhầm file test trùng |
| C2 | P2: "batch/bars (`:267-268`, `:376`)" | `:267-268` thuộc `RealtimePriceBoardView` (price-board đơn mã) | R2 — coder tìm nhầm vị trí serialize |
| C3 | P3: "`spread` null-safe" + AC "spread không crash (`typeof` guard)" | Guard thật là `?? 0` (`:65`) + `!== undefined` (`:164`, luôn true); `null` → hiển thị `0.00` | V2 — không crash nhưng số hiển thị bịa |

## 6. Quality gates (đọc plan, chưa chạy lại — auditor read-only)

Baseline plan khai (B-1..B-12: check-multi-agent 0 lỗi, ledger 90/89/max477, lessons 59/60, secrets/light/i18n/page-registry/tsc 0, rev-list 6) khớp trạng thái đo được ở closeout-dot1 + các xác minh mục §1. Fail-before yêu cầu chạy trên VPS trước code là đúng (BE test cần Postgres + `DJANGO_DEBUG`). Không phát hiện khai PASS cho thứ chưa chạy trong plan.

## 7. Đề xuất fix (2 dòng)

1. Scope §2: `packages/core/backend/tests/test_native_views.py` → `packages/core/backend/src/market_serving/tests/test_native_views.py`.
2. P2 (§0-mục 2): "quote endpoint (`:67-81`, `:125-144`) + batch/bars (`:267-268`, `:376`)" → "quote đơn `:67-81` + price-board `:267-268` + batch `:125-144` + profile `:376`".
