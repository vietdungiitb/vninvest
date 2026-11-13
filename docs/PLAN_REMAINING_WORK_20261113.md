# PLAN — Công việc còn dở sau handoff 2026-11-12/13 (rev 1)

> **Ngày:** 2026-11-13 · **Trạng thái:** KẾ HOẠCH — **CHƯA THỰC THI** (slice này doc-only)
> **Claim:** `remaining-work-plan-20261113` · **Branch:** `feat/remaining-work-plan-20261113`
> **Base đo:** `origin/dev` @ `55a6a8741` (đã fetch, không dùng worktree chính đang có file chưa commit của session khác)
> **Nguồn:** 5 handoff trong `docs/handoffs/` + `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md` §2/§8 + `docs/BACKEND_QA_ANSWERS_QB1_QB4_2026-11-12.md` + `docs/MASTER_TRACKING_2026Q4.md` §6
> **Lessons áp dụng:** [L-001 L-002 L-003 L-G01 L-G02 L-G05 L-M02 L-V01 L-V02 L-V03 L-T01 L-T02]
> **Audit độc lập (2026-11-13, subagent read-only):** `NEED_REVISION` — 3 blocker + 3 major, đã sửa trong rev 2 (xem `docs/evidence/remaining-work-plan/audit.md`).

---

## 0. Kết luận 1 trang

1. **3 việc P0 đang chặn mọi PR** (không phải việc tính năng):
   - `secret-scan` đỏ trên **mọi push** vì `docs/evidence/staging-pro-layout/facts20.json:7-10` chứa token thật `vni_internal_…` (77 ký tự, sha256 `ec8f9b90`). CI `secret-scan` đỏ 5/5 run gần nhất của `dev`.
   - `check-ledger-entry` đỏ vì **Entry 386 xuất hiện 2 lần** (ledger dòng 969 và 1036); baseline 2026-10-13 không có 386.
   - **8 test đỏ** trong full suite VPS: 7 test do **D2** (`RechartsCompat` → echarts canvas trên jsdom) + 1 test do **D3** (S4 đọc `vi.js`/`en.js` trong khi key đã dời sang `locales/vi|en/stockDetail.js`).
2. **Đính chính quan trọng:** 7 test echarts **KHÔNG phải pre-existing** như Entry 474 đã ghi — chúng là **regression của D2** (`b3920f980`). `AIUsageDashboard.tsx:11` đổi import sang `RechartsCompat`, shim dùng `CanvasRenderer` (`RechartsCompat.tsx:46,58`), trong khi `vitest.config.ts:13` để `setupFiles: []` và 2 file test **không** mock shim. Cần đính chính bằng Entry mới khi sửa (không sửa lịch sử Entry 474).
3. **Backend Enterprise còn 5 hạng mục** B-2..B-6, trong đó B-2/B-5/B-6 là S/M (đã đo lại: B-5 và B-6 nhỏ hơn spec), B-3/B-4 là M. Q-B1 đã trả lời (không có order book thật); Q-B2/Q-B4 **chưa probe**; Q-B3 đã trả lời (không cash_flow, kỳ quarter hardcode).
4. **Thứ tự đề xuất:** Đợt 0 (gate xanh) → Đợt 1 (B-5 + 2 probe) → Đợt 2 (B-2 + B-4) → Đợt 3 (B-3 + B-6) → Đợt 4 (C2/C3 + E2E/visual/deploy) → Đợt 5 (vệ sinh claim/worktree).
5. **8 quyết định cần Owner** ở §6 — trong đó 2 quyết định chặn ngay: cách xử lý Entry 386 (re-baseline hay đánh số lại) và B-2 chọn (a) bỏ route hay (b) giữ route nhưng trả rỗng trung thực.

---

## 1. Baseline đo được (chạy thật trên worktree `vninvest-wt-plan` @ `55a6a8741`)

| Gate | Lệnh | Kết quả | Ghi chú |
|---|---|---|---|
| multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | **PASS** (0 lỗi) | 165 warning (phần lớn là claim cũ parse multi-file path như 1 path); claim mới của slice này góp 3 warning — không blocker |
| ledger | `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | **FAIL** | `Entry 386: xuat hien 2 lan, baseline cho phep 0` |
| secret | `node packages/web/scripts/scan-secrets.mjs` | **FAIL** | `docs/evidence/staging-pro-layout/facts20.json:7-10` — `vni_***(len=77,sha256=ec8f9b90)` |
| lessons | `node scripts/check-lessons.mjs` | **PASS** | (chưa đụng `docs/LESSONS/` trong slice này) |
| full FE suite | VPS `/tmp/wt-fullvitest` (run 2026-11-13) | **8 failed / 1243 passed (1251)**, 3 file đỏ | log đầy đủ 256KB; evidence `docs/evidence/full-vitest-vps-20261113/gates.md` |

**8 test đỏ (danh sách đầy đủ, từ log VPS):**

| # | File | Test | Quy kết |
|---|---|---|---|
| 1-6 | `packages/web/src/components/AIUsageDashboard.component.test.js` | Slice 3 ×3, F2, AC6, F1 | D2 regression — echarts canvas |
| 7 | `packages/web/src/components/__tests__/ai-usage-chart-r16.component.test.ts` | AC3 chart aria-hidden + bảng số | D2 regression — cùng nguyên nhân |
| 8 | `packages/web/src/components/__tests__/vnstock-chart-panel.data-unlock.component.test.ts` | S4 `chartIndicators` | D3 regression — test đọc sai vị trí key |

---

## 2. Bảng tổng hợp việc còn dở

| ID | Việc | Nguồn | Trạng thái thật (verify) | Ưu tiên | Effort |
|---|---|---|---|---|---|
| S0.1 | Redact token trong `facts20.json` + Owner revoke token | HANDOFF FULL-VITEST §3, CI log | **CHƯA LÀM** — scan-secrets FAIL | **P0** | S |
| S0.2 | Re-baseline Entry 386 (hoặc đánh số lại — cần Owner) | HANDOFF B-1 §3.4, sidebar §4 | **CHƯA LÀM** — check-ledger-entry FAIL | **P0** | S |
| S0.3 | Fix 7 test D2 (mock `RechartsCompat`) | HANDOFF FULL-VITEST §2 (quy kết sai) | **CHƯA LÀM** — 7 đỏ | **P0** | S |
| S0.4 | Fix S4 D3 (đọc `locales/vi|en/stockDetail.js`) | HANDOFF FULL-VITEST §4 | **CHƯA LÀM** — 1 đỏ | **P0** | S |
| S0.5 | Chạy lại full suite VPS sau S0.3+S0.4 | HANDOFF FULL-VITEST §3 | **CHƯA CHẠY** | **P0** | S |
| S1.1 | B-5 data hygiene (số là số, Unix ms, timeframe canonical, envelope `code`) | spec §2 B-5, QA §5.2 | **CHƯA LÀM (phạm vi hẹp hơn spec)** — `str(price)` còn ở `native_views.py:69,128,267,376`; `/bars/` **đã** có `INVALID_TIMEFRAME`/Unix ms (`stock_mgmt_native_views.py:4148-4186`); lệch thật: `/chart/` nhận `30m`+`Y`, `/bars/` từ chối | **P1** | M |
| S1.2 | Probe Q-B2 (`Company.events()` có ex-date/ratio?) | QA §2 | **CHƯA CHẠY** | **P1** (chặn B-3) | S |
| S1.3 | Probe Q-B4 (độ phủ `IntradayTick`) | QA §4 | **CHƯA CHẠY** | P2 (E4) | S |
| S2.1 | B-2 depth-chart bỏ dữ liệu giả | spec §2 B-2, QA §1 | **CHƯA LÀM** — `is_mock`/`synthetic_from_snapshot` còn ở `native_views.py:451,453,522,524` | **P1** | S/M |
| S2.2 | B-4 fundamentals contract typed | spec §2 B-4, QA §3 | **CHƯA LÀM** — `financials` vẫn `object nullable`; kỳ `quarter` hardcode `vnbroker_adapter.py:1226,1239,1252` | **P1** | M |
| S3.1 | B-3 corporate actions + `adj_close` | spec §2 B-3 | **CHƯA LÀM** — grep `adj_close|corporate_action|adj_factor` = **0 hit** | P2 (chặn bởi S1.2) | M |
| S3.2 | B-6 P0: PAT scope cho market/signal/advisory + đóng OpenAPI | spec §2 B-6 | **CHƯA LÀM (2/5 hạng mục đã có sẵn)** — 0 scope check trong `market_serving/`, `market_data/`, `signal_intelligence/`, `advisory/`; schema public `vninvest_core/urls.py:56-58`; **đã có**: `X-RateLimit-*` (`identity_access/middleware.py:579-612`), admin-ops 410 (`vninvest_core/urls.py:78-79`), SSE không bị cắt (ping 15s + `/api/` 300s `packages/web/docker/nginx.conf:289`) | **P1** (bán B2B) | S/M |
| S4.1 | C2 chart-defer (~-700KB initial) | HANDOFF D2D3 §3-4 | **CHƯA LÀM** | P2 | M |
| S4.2 | C3 lazy i18n namespace | HANDOFF D2D3 §3-4 | **CHƯA LÀM** | P3 | M |
| S4.3 | E2E sidebar click không reload | HANDOFF SIDEBAR §4 | **CHƯA CHẠY** | P2 | S |
| S4.4 | Visual baseline win32 | HANDOFF D2D3 §2-4 | **CHƯA CHẠY** (chỉ có baseline win32; Linux không có) | P3 | S/M |
| S4.5 | Deploy staging từ `dev` | HANDOFF D2D3 §4, CONTRAST §5 | **CHƯA LÀM** — `/opt/vninvest` @ `5cd3a347d` (local debug), không phải `dev` | **Owner** | S |
| S5.1 | Đóng claim `in-progress` stale | §7 MASTER_TRACKING A2 | **CHƯA LÀM** — 17 claim đang mở theo `audit-status-claims.mjs` (15 in-progress + 2 proposed), trong đó ~13 stale; MASTER_TRACKING A2 chỉ ghi đóng 8 | P2 | S |
| S5.2 | Dọn worktree `vninvest-wt-b1` (B-1 đã xong) | HANDOFF B-1 §4 | **CHƯA LÀM** — còn detached `4e86657e4` | P3 | S |
| S5.3 | Rotate/revoke `GITHUB_TOKEN` đã paste chat | HANDOFF D2D3 §3, CONTRAST §5 | **CHƯA XÁC NHẬN** | **Owner P0** | S |

### 2.1 CONTRADICTIONS — spec/handoff nói vs code thật (đo 2026-11-13)

| # | Nguồn nói | Code thật | Tác động |
|---|---|---|---|
| C1 | HANDOFF FULL-VITEST §2 quy 7 test echarts là "pre-existing" | Regression của D2 `b3920f980`: `AIUsageDashboard.tsx:11` → `RechartsCompat.tsx:46,58` (CanvasRenderer) + `vitest.config.ts:13` `setupFiles: []` | Nếu tin "pre-existing" thì không ai sửa; thực tế sửa được bằng mock có sẵn |
| C2 | Spec B-5: "timeframe khác nhau, cần canonical hoá" | `/bars/` **đã** canonical + `INVALID_TIMEFRAME` + Unix ms (`stock_mgmt_native_views.py:4148-4186`); chỉ `/chart/` nhận thêm `30m`/`Y` và fallback im lặng (`:902-920`) | B-5 nhỏ hơn spec: 1 enum dùng chung + `code` cho quote/alerts |
| C3 | Spec B-6: "admin-ops luôn 401", "thiếu `Retry-After`/`X-RateLimit-*`", "SSE bị nginx cắt sau 120s" | admin-ops = **410** mọi request (`vninvest_core/urls.py:39-44,79` + `identity_access/middleware.py:66-68`); `X-RateLimit-*` có (`identity_access/middleware.py:579-612`) + DRF tự thêm `Retry-After`; SSE có ping 15s (`signal_intelligence/views.py:778`) và FE đi qua `/api/` = 300s (`packages/web/docker/nginx.conf:277-289`) | B-6 thực chất còn **2** việc: scope cho market/signal/advisory + đóng schema |
| C4 | Spec B-6: "8 caller chỉ dùng `manage_tenant`" | 8 caller đó là **partner billing/usage** — `manage_tenant` hợp lý; lỗ thật là `market_serving/`, `market_data/`, `signal_intelligence/`, `advisory/` có **0** scope check | Sửa đúng chỗ: thêm scope cho 4 app đó, không đổi 8 caller partner |
| C5 | Spec B-6 tham chiếu `frontend/docker/nginx.conf:201` | Không tồn tại; file thật là `packages/web/docker/nginx.conf` (120s ở `:303` cho `/core/v1/`, 300s ở `:289` cho `/api/`) | Tránh sửa file ma; và "cắt sau 120s" không xảy ra vì ping 15s |

---

## 3. Đợt 0 — Gate xanh (P0, làm ngay, 1 ngày)

### S0.1 — Redact token trong evidence + revoke token

**Vấn đề:** `docs/evidence/staging-pro-layout/facts20.json:7-10` chứa `vni_internal_<77 ký tự>` (lặp 4 lần trong mảng `errors`). Đây là token thật bị lộ trong log WebSocket; `scan-secrets` FAIL và CI `secret-scan` đỏ trên mọi push từ 2026-11-12.

**Việc làm:**
1. Thay giá trị bằng `vni_internal_REDACTED` (scanner bỏ qua marker `REDACTED` — `scan-secrets.mjs:211,232`). Giữ nguyên phần text lỗi để evidence còn giá trị.
2. `git grep -l "vni_internal_"` trên toàn repo phải = 0 file (đã đo: chỉ 1 file).
3. Thêm `docs/evidence/staging-pro-layout/REDACTION_20261113.md` ghi: token bị lộ, đã redact, **Owner cần revoke/rotate**, history vẫn chứa (repo private).
4. **Owner:** revoke token trên hệ thống cấp PAT (không phải việc code). Nếu token còn sống thì redact chỉ che mắt người đọc, không giảm rủi ro.

**AC (Given/When/Then):**
- Given file đã redact, When chạy `node packages/web/scripts/scan-secrets.mjs`, Then exit 0 và không còn dòng `facts20.json`.
- Given push lên `dev`, When CI `secret-scan` chạy, Then job `scan` xanh.
- Given token đã bị lộ, When Owner revoke, Then token cũ không dùng được (kiểm bằng 1 request 401 — **CHƯA CHẠY** nếu không có token).
- Given plan có nhắc chuỗi `vni_internal_` trong prose, When chạy `git grep -l "vni_internal_"`, Then vẫn có thể trả ≥1 file (chính plan) — **không** dùng điều kiện này làm AC; AC là `scan-secrets` exit 0 + 0 file runtime/evidence chứa giá trị token thật.

**Gate:** `scan-secrets` (local) + CI `secret-scan` (sau push). **Không** sửa lịch sử git (repo private; purge history là quyết định riêng, tốn force-push).

---

### S0.2 — Re-baseline Entry 386 (cần Owner chốt cách)

**Vấn đề:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` có 2 `## Entry 386`: dòng 969 (VNBroker console, 2026-10-20) và dòng 1036 (Enterprise demo spec, 2026-11-12). `ledger-entry-baseline.json` đo 2026-10-13 chỉ có tần suất 2 cho các số cũ, **không có 386** → gate coi đây là trùng mới và FAIL.

**2 phương án:**
- **(a) Re-baseline (khuyến nghị):** thêm `"386": 2` vào `frequencies`, cập nhật `_measured_at` = 2026-11-13, `_measured_from` = `origin/dev@55a6a8741`, và `totals` (headers/distinct/dupGroups/extras/max) bằng script — không sửa tay số. Lý do: Owner đã chốt **không đánh số lại lịch sử** (baseline `_comment`), và Entry 386 đã merge vào `dev` từ PR #353.
- **(b) Đánh số lại Entry 386 mới (11-12) thành 475:** chỉ làm nếu Owner cho phép; phải sửa cả dòng index cuối ledger và mọi trích dẫn `Entry 386` liên quan (grep trước). Rủi ro: phá citation.

**AC:** `check-ledger-entry` exit 0; thêm 1 Entry trùng số bất kỳ trong bản nháp → gate vẫn FAIL (chứng minh gate không bị vô hiệu hoá).

**Gate:** `check-ledger-entry` + `check-lessons` (nếu sửa `docs/LESSONS/` — không sửa).

---

### S0.3 — Fix 7 test D2 (regression, không phải pre-existing)

**Root cause đã verify:**
- `packages/web/src/components/AIUsageDashboard.tsx:11` import từ `./charts/RechartsCompat`.
- `packages/web/src/components/charts/RechartsCompat.tsx:46,58` dùng `CanvasRenderer`; render qua `ReactEChartsCore` (`:603,670`).
- `packages/web/vitest.config.ts:13` — `setupFiles: []`; 2 file test render component thật, **không** `vi.mock` shim.
- Lỗi thật: `TypeError: Cannot set properties of null (setting 'dpr')` tại `zrender/lib/canvas/Layer.js:82` (jsdom không có canvas).

**Fix tối thiểu (không thêm dependency):**
1. Trong `AIUsageDashboard.component.test.js` thêm `vi.mock("./charts/RechartsCompat")` (đường dẫn resolve từ file test).
2. Trong `ai-usage-chart-r16.component.test.ts` thêm `vi.mock("../charts/RechartsCompat")`.
3. Dùng mock có sẵn `packages/web/src/components/charts/__mocks__/RechartsCompat.tsx` (render `div` rỗng). Kiểm lại AC3: `data-testid="usage-chart"` nằm ở `AIUsageDashboard.tsx:380` (không phải chart) và bảng `.srOnly` vẫn render → test AC3 không bị vô hiệu.
4. **Không** mock cả `AIUsageDashboard` — sẽ làm AC3/AC6 thành tautology.

**Lưu ý (audit 2026-11-13):** `CLAIMS.md:1165` claim `uiux-w11-alerturl` trạng thái **abandoned** liệt kê `AIUsageDashboard.component.test.js` trong scope. Claim abandoned không còn giữ file, nhưng coordinator phải xác nhận trước khi sửa (xem §S0.4). Nếu chưa xác nhận, chỉ làm patch đề xuất, không commit.

**Fail-before:** chạy 2 file trên VPS trước fix → 7 đỏ; sau fix → xanh. Ghi log.

**AC:** 2 file xanh; full suite không còn lỗi `dpr`/zrender; AC3 vẫn assert `aria-hidden="true"` + `.srOnly` có số.

**Ledger:** Entry mới ghi rõ **đính chính Entry 474**: 7 test này là regression D2 (`b3920f980`), không phải pre-existing.

---

### S0.4 — Fix S4 D3 (test stale)

**Root cause đã verify:**
- `vnstock-chart-panel.data-unlock.component.test.ts:24-29` đọc `i18n/vi.js` + `i18n/en.js`; `:53-55` assert `chartIndicators:`.
- D3 tách monolith → `packages/web/src/i18n/locales/vi/stockDetail.js:2` (`chartIndicators: 'Chỉ báo'`) + `locales/en/stockDetail.js:2` (`'Indicators'`); `vi.js`/`en.js` chỉ còn barrel (8193 byte, không chứa key).

**Fix:** đổi `VI_I18N`/`EN_I18N` sang 2 file locale mới (giữ nguyên ý nghĩa test: key có ở **cả** vi và en). Không sửa runtime i18n.

**AC:** S4 xanh; `npm run i18n:scan` không đổi; full suite không còn S4 đỏ.

**Lưu ý (audit 2026-11-13):**
- `CLAIMS.md:1815` có claim `w0-9-chart-data-unlock` trạng thái **in-progress** (worktree `agent-w0-9`) liệt kê đúng file test này, trong khi `CLAIMS.md:1821` có bản **done** (PR #282). Đây là claim stale chưa đóng. **Trước khi sửa file**, coordinator phải release claim `w0-9-chart-data-unlock` (mark `released`) hoặc xác nhận worktree `agent-w0-9` đã bị bỏ. Nếu không, sửa vi phạm protocol §2.
- `CLAIMS.md:1165` có claim `uiux-w11-alerturl` trạng thái **abandoned** liệt kê `AIUsageDashboard.component.test.js`. Claim abandoned không còn giữ file — nhưng coordinator phải xác nhận trước khi touch file trong S0.3.
- Nếu coordinator không chốt được trước Đợt 0, đổi phạm vi S0.3/S0.4 thành "đọc/đề xuất patch only, không commit" và dời sang sau cleanup.

---

### S0.5 — Chạy lại full suite trên VPS

**Lệnh (runbook §12.4):**
```bash
cd /opt/vninvest && git fetch origin dev --quiet
git worktree add /tmp/wt-fullvitest-r2 origin/dev
cd /tmp/wt-fullvitest-r2/packages/web && /usr/bin/corepack npm ci
/usr/bin/corepack npm run test:components > /tmp/wt-fullvitest-r2.log 2>&1
```
**AC:** `Test Files 0 failed`, `Tests 0 failed`; nếu còn đỏ → ghi rõ file/test/owner, **không** báo PASS. Evidence `docs/evidence/full-vitest-vps-20261113-r2/gates.md`; dọn worktree + log sau khi lấy excerpt.

**Thứ tự bắt buộc:** S0.1-S0.4 merge vào `dev` → rebase → chạy suite trên đúng `origin/dev` sau merge (L-G01).

---

## 4. Đợt 1 — B-5 + 2 probe (P1, 2-3 ngày)

### S1.1 — B-5 data hygiene

**Hiện trạng đã verify (đo lại 2026-11-13, không tin spec mù):**
- `market_serving/native_views.py:69,128,267,376` — `'price': str(snap.price)` (Decimal → string).
- `/bars/` **đã đúng chuẩn**: `timeframe` validate + 400 `{'code': 'INVALID_TIMEFRAME'}` (`market_data/stock_mgmt_native_views.py:4148-4168`), `limit` có `INVALID_LIMIT`/`LIMIT_EXCEEDED` (`:4170-4186`), timestamp Unix ms (`:4104-4110`).
- `/chart/` **lệch**: `_normalize_timeframe` nhận thêm `30m`, `Y`/`1Y` (`stock_mgmt_native_views.py:902-920`) và **fallback im lặng** khi sai; `/bars/` chỉ nhận `1m 5m 15m 1H 2H 4H D W M` (`:3887`) ⇒ cùng 1 symbol, `?timeframe=30m` cho kết quả ở `/chart/` nhưng 400 ở `/bars/`.
- Envelope lỗi 2 route B-1 chỉ có `detail` (`native_views.py:571,574,576,578`, `:1393,1396,1400`); `git grep invalid_query` = **0 hit** (mã đang dùng là `INVALID_TIMEFRAME`/`INVALID_LIMIT` — UPPER_SNAKE, không phải `invalid_query`).

**Việc làm (scope hẹp, đúng spec §2 B-5):**
1. Chuẩn hoá `price`/`close`/`open`/`high`/`low` → JSON number ở endpoint demo (quote single + batch + bars).
2. `timestamp` → Unix ms (bars **đã đúng**; giữ `date` ISO ở `/chart/` nếu widget đang dùng — **không breaking** nếu chưa chốt).
3. Timeframe: 1 enum canonical dùng chung cho `/chart/` + `/bars/`; sai → 400 `code` (giữ convention UPPER_SNAKE hiện có, **không** đổi sang `invalid_query` để khỏi phá client đang đọc `INVALID_TIMEFRAME`).
4. Envelope lỗi: thêm `code` cho 4xx của 2 route B-1 (bars đã có; quote/alerts chưa).
5. Contract test: `typeof body.price === 'number'`, `Number.isInteger(timestamp)`, `code` có mặt.

**Rủi ro breaking:** FE `adapters/core/market.js` và widget đang đọc `price` string. **Bắt buộc** audit + thông báo widget team trước khi merge (spec §3). Nếu chưa an toàn: thêm field số mới (`price_num`) trong 1 release, giữ field cũ — cần Owner chốt (D2).

**Gate:** BE test `market_serving` + `market_data` trên VPS (Postgres riêng, runbook §12.3); `spectacular` 0 warning; `makemigrations --check` không đổi.

---

### S1.2 — Probe Q-B2 (chặn B-3)

**Mục tiêu:** xác định `Company.events()` (vnbroker/KBS) có `ex_date`/`ratio`/loại sự kiện hay không.

**Cách chạy (VPS, read-only):**
```bash
ssh root@14.225.255.47
docker exec -i vninvest-core-api python manage.py shell -c "
import json
from market_data.vnbroker_adapter import fetch_company_info  # vnbroker_adapter.py:1138; gọi company.events() ở :1188
data = fetch_company_info('VNM')
open('/tmp/qb2.json','w').write(json.dumps(data.get('events', [])[:5], ensure_ascii=False, default=str))
"
docker cp vninvest-core-api:/tmp/qb2.json /tmp/qb2.json && cat /tmp/qb2.json
```
- Nếu hàm không đúng tên → đọc `vnbroker_adapter.py:1186-1197` để gọi đúng `company.events()`.
- **Không** ghi DB, **không** đổi code; chỉ đọc.
- Kết quả ghi `docs/evidence/enterprise-demo-b1/qb2-probe.md` (command + sample JSON đã redact + kết luận).

**AC:** có sample `events` thật; kết luận rõ **CÓ/KHÔNG** ex-date/ratio; nếu không → B-3 đi fallback `adjusted:false` + note.

---

### S1.3 — Probe Q-B4 (E4, không chặn demo)

**Cách chạy:**
```bash
docker exec vninvest-core-db psql -U <user> -d <db> -c "
SELECT count(DISTINCT symbol) AS symbols,
       min(timestamp) AS min_ts,
       max(timestamp) AS max_ts
FROM market_data_intraday_tick
WHERE timestamp >= now() - interval '1 day';"
```
- Lấy user/db từ `compose.staging.env` **không in ra console** (dùng biến).
- Kết quả ghi `docs/evidence/enterprise-demo-b1/qb4-probe.md`; kết luận cho E4 (có đủ phủ để hứa sub-second không).

---

## 5. Đợt 2-3 — B-2, B-4, B-3, B-6

### S2.1 — B-2 depth-chart: bỏ dữ liệu giả

**Hiện trạng:** `native_views.py:451,453,522,524` — `is_mock: True`, `source: 'synthetic_from_snapshot'`; bids/asks sinh từ snapshot `:469-478`.

**2 lựa chọn (cần Owner chốt D1):**
- **(a) Bỏ route** `realtime/depth-chart/<symbol>/` khỏi `market_serving/urls.py` (spec §2 B-2 phương án b). Hệ quả: FE `adapters/core/market.js:350-356` gọi route này sẽ 404; `StockOrderBookWidget.jsx:153-161` đang hiện badge "Dữ liệu ước tính" — phải sửa FE + thông báo widget.
- **(b) Giữ route, trả rỗng trung thực (khuyến nghị):** bỏ `is_mock`/`synthetic_from_snapshot`; trả `bids: []`, `asks: []`, `spread: null`, `data_quality: 'unavailable'`, `note: 'orderbook_not_available'`. Giữ contract route, không bịa số; FE badge cần đọc `data_quality` thay vì `is_mock`.

**AC:** response **không** còn chuỗi `is_mock`/`synthetic_from_snapshot`; test assert `bids == []` + `note`; widget team nhận thông báo; nếu (a) thì test assert 404 + FE không còn gọi.

---

### S2.2 — B-4 fundamentals contract typed

**Hiện trạng:** `vnbroker_adapter.py:1215-1274` — `ratio`/`income_statement`/`balance_sheet` với `period='quarter'` hardcode (`:1226,1239,1252`), **không** `cash_flow`; schema `_STOCK_FINANCIALS_SCHEMA` (`market_data/stock_mgmt_native_views.py:311-319`) chỉ typed envelope, lõi `financials` là `{'type': 'object', 'nullable': True}` (`:315`).

**Việc làm:**
1. Chuẩn hoá mỗi record: `period`, `year`, `quarter`, `report_date` (nullable), `items` (object) — key cố định.
2. `?period=quarter|year`: nếu vnbroker không hỗ trợ `year` → trả 400 `code=invalid_query` (không silently fallback) — chờ kết quả probe (S1.2 mở rộng hoặc probe riêng).
3. `cash_flow`: không có nguồn → `null` + `note` (không bịa).
4. `@extend_schema` + serializer → `spectacular` ra `$ref`, không `{}`.
5. Số là number, thiếu là `null` (không `""`).

**AC:** OpenAPI có schema cho endpoint; response đúng 4 key cố định; `period=year` hoạt động hoặc 400 có `code`; test fail-before → pass-after.

---

### S3.1 — B-3 corporate actions + `adj_close` (sau S1.2)

**Nhánh A — probe thấy ex-date/ratio:** model `CorporateAction` (`symbol`, `action_type`, `ex_date`, `ratio`, `amount`, `currency`, `source`, `fetched_at`) + migration do `makemigrations` sinh + endpoint `corporate-actions/` + `adj_close` trong bars. Test trên 1 symbol có sự kiện thật.

**Nhánh B — probe không thấy:** bars trả `adjusted: false` + `note` ("backend chưa điều chỉnh") — theo spec §2 B-3 phương án b; **không** suy đoán `adj_close`.

**AC:** bars có `adjusted` + (`adj_close` | `note`); test dương tính với symbol có sự kiện (nhánh A) hoặc test khẳng định không bịa (nhánh B).

---

### S3.2 — B-6 P0 bảo mật (tách 3 sub-slice nếu cần)

**Hiện trạng đã verify (đo lại 2026-11-13):**
- **Lỗ thật #1 — market/signal/advisory không check scope nào:** `git grep require_pat_scopes` trong `market_serving/`, `market_data/`, `signal_intelligence/`, `advisory/` = **0 hit cả 4**. 53 caller hiện có đều thuộc `identity_access/`, `commercial/` (đều `manage_tenant`). Scope `market:read`/`signals:read`/`ai:invoke` **đã tồn tại** trong catalog (`identity_access/serializers.py:20-27`) nhưng chưa endpoint nào dùng.
- **Lỗ thật #2 — OpenAPI public:** mount vô điều kiện `vninvest_core/urls.py:56-58`; `SPECTACULAR_SETTINGS` không đặt `SERVE_PERMISSIONS` (`vninvest_core/settings.py:431-441`) ⇒ drf-spectacular dùng `AllowAny`; middleware exempt `identity_access/middleware.py:41-43` + quota-exempt `:333`.
- **Đã có sẵn (không cần làm):** `X-RateLimit-Limit/Remaining/Reset/Resource` (`identity_access/middleware.py:579-612`, `identity_access/throttles.py:132-144`); DRF tự thêm `Retry-After` cho `Throttled`; `/api/admin-ops/*` trả 410 cho **mọi** request vì middleware cho unauthenticated đi qua (`identity_access/middleware.py:66-68`) rồi tới `admin_ops_gone` (`vninvest_core/urls.py:39-44,79`); nginx đã có `location ^~ /api/soc/` + `proxy_read_timeout 300s` (`packages/web/docker/nginx.conf:238-248`), FE path `/api/` cũng 300s (`:277-289`), và SSE ping 15s (`signal_intelligence/views.py:778`).

**Việc làm (thu gọn còn 2 hạng mục):**
1. Enforce scope theo nhóm endpoint: `market:read` (market_serving/market_data), `signals:read` (signal_intelligence), `ai:invoke` (advisory); PAT thiếu scope → 403 `code=permission_denied` (dùng `require_pat_scopes_or_human_session` có sẵn — human session được bỏ qua).
2. Đóng schema khi `DEBUG=False`: 404 hoặc staff-auth (chốt D4); bỏ khỏi 2 exempt list tương ứng.
3. ~~`Retry-After`/`X-RateLimit-*`~~ — **đã có**, chỉ thêm test hồi quy khẳng định header trên 429.
4. ~~admin-ops 410 trước auth~~ — **đã đúng**, chỉ thêm test hồi quy.
5. ~~nginx SSE timeout~~ — **không phải lỗi thật**: SSE ping 15s (`signal_intelligence/views.py:778`) < 120s, và FE đi qua `/api/` = 300s (`packages/web/docker/nginx.conf:289`); không sửa.

**AC:** PAT `scopes=[]` gọi market data → 403 `code=permission_denied`; `/core/v1/schema/` khi `DEBUG=False` → 404/403; probe **từ ngoài** không header → không 200; test hồi quy 429 có `Retry-After` + `X-RateLimit-*`; test hồi quy `/api/admin-ops/x` = 410 không cần auth; test BE fail-before → pass-after.

---

## 6. Quyết định cần Owner (chặn kế hoạch)

| # | Quyết định | Đề xuất | Chặn |
|---|---|---|---|
| **D1** | B-2: (a) bỏ route depth-chart hay (b) giữ route trả rỗng trung thực? | **(b)** — giữ contract, bỏ số giả; thông báo widget team | S2.1 |
| **D2** | B-5: cho phép breaking `price` string → number ngay, hay thêm field số mới 1 release? | **Breaking ngay** nếu widget team xác nhận (họ đang viết adapter); nếu chưa → field mới | S1.1 |
| **D3** | B-4: `period=year` không được upstream hỗ trợ → 400 `invalid_query` hay fallback `quarter`? | **400** với `code` (giữ convention UPPER_SNAKE như `INVALID_TIMEFRAME`) — không giả data | S2.2 |
| **D4** | B-6: schema khi `DEBUG=False` → 404 hay staff-auth? | **404** (đúng AC spec) | S3.2 |
| **D5** | Entry 386: re-baseline hay đánh số lại? | **Re-baseline** (giữ lịch sử, đúng Owner rule) | S0.2 |
| **D6** | Deploy staging từ `dev` hiện tại? | **Chờ sau Đợt 0** (gate xanh rồi deploy) | S4.5 |
| **D7** | Rotate/revoke `GITHUB_TOKEN` đã paste chat + token `vni_internal_` trong evidence? | **Revoke ngay** (P0 secret) | S0.1 |
| **D8** | C2/C3 có ưu tiên trước B-2..B-6? | **Không** — B-2..B-6 là hợp đồng với widget team | S4.1/S4.2 |

---

## 7. Thứ tự thực thi + timeline đề xuất

| Ngày | Việc | Owner | Gate cuối |
|---|---|---|---|
| 1 | S0.1 + S0.2 (2 PR nhỏ, docs/evidence) | agent + Owner revoke | `scan-secrets` 0 · `check-ledger-entry` 0 |
| 1-2 | S0.3 + S0.4 (2 PR test-only) | agent | 2 file test xanh trên VPS |
| 2 | S0.5 full suite VPS | agent | 0 failed / 1251 |
| 3 | S1.2 + S1.3 probes | agent | evidence Q-B2/Q-B4 |
| 3-5 | S1.1 B-5 | agent | BE test + spectacular |
| 5-6 | S2.1 B-2 + S2.2 B-4 | agent | BE test + widget sign-off |
| 7-9 | S3.1 B-3 + S3.2 B-6 | agent | BE test + probe ngoài |
| 10+ | S4.1/S4.2/S4.3 | agent/QA | perf + E2E |
| — | S4.4/S4.5/S5.x | Owner/coordinator | — |

**Nguyên tắc:** mỗi slice 1 claim + 1 worktree riêng + 1 PR; rebase → chạy lại gate → mới báo kết quả (L-G01/L-G03). Không gộp B-5 với B-2 (khác contract, khác test).

---

## 8. Non-goals (không làm trong đợt này)

- Không purge git history (token cũ) — repo private, Owner quyết định riêng.
- Không làm lại toàn bộ namespace `/core/v1/<domain>/v1/` (spec §4 defer).
- Không thêm `cash_flow` model/history (spec §4 defer).
- Không mở realtime sub-second khi chưa có Q-B4 (spec §4 defer).
- Không sửa visual baseline Linux (chỉ có baseline win32; update từ Linux sẽ hỏng baseline).
- Không đụng `vninvest-wt-bespec` (claim `chart-widget-team` in-progress) và untracked docs của session khác.

---

## 9. Rollback

- S0.1: revert 1 file evidence + note redaction; token đã revoke thì không cần khôi phục.
- S0.2: revert baseline JSON; gate trở lại đỏ (không ảnh hưởng runtime).
- S0.3/S0.4: revert 2-3 file test; không ảnh hưởng production.
- B-2..B-6: mỗi slice 1 PR; revert theo PR. B-5 có rủi ro breaking → nếu widget/FE vỡ, revert PR B-5 (không revert lẻ file).
- Deploy staging: giữ image cũ + `compose.staging.env.bak-*` trên VPS; rollback bằng `docker compose up -d` image cũ.

---

## 10. Checklist trước khi coi từng slice xong (DoD)

- [ ] Claim `in-progress` **trước** dòng code đầu tiên; branch = `feat/<tên-agent>` đúng ký tự.
- [ ] Worktree riêng (không làm trên worktree chính).
- [ ] Fail-before chạy thật (test đỏ trên code cũ) → pass-after.
- [ ] `tsc --noEmit` 0 · `eslint` 0 error · `build` PASS (FE, trên VPS theo §12.4).
- [ ] BE test trên VPS Postgres riêng; `makemigrations --check` không đổi; `spectacular` 0 warning.
- [ ] `check-multi-agent` 0 lỗi · `check-ledger-entry` 0 · `scan-secrets` 0 · `check-lessons` 0.
- [ ] `git diff --numstat` đúng file dự kiến (không mojibake/EOL drift).
- [ ] Ledger 1 Entry mới (không sửa Entry cũ) + claim `done` + PR merge-commit.
- [ ] Báo cáo ghi rõ **PASS / FAIL / CHƯA CHẠY** — không suy diễn.
