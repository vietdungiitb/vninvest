# TẬP SLICE 3 — WAVE 4 BROKER · WAVE 5 PAPER · WAVE 6 LIVE · WAVE 7 HARDENING

**Ngày:** 2026-09-27 · 23 slice · 80–101 ed
**Đọc trước:** `docs/PORTFOLIO_EXEC_PLAN_MASTER_20260927.md` §0 · `docs/PORTFOLIO_UI_UX_DESIGN_SPEC_20260927.md` §3.1.1-D · `docs/AGENT_PROTOCOL.md`
**Điều kiện mở Wave 5:** Wave 4 xong **và** FE-01 xong **và** widget 1.4.x đã cài
**Điều kiện mở Wave 6:** Wave 5 xong · **Điều kiện mở Wave 7:** Wave 6 xong

---

# WAVE 4 — BROKER HUB

## BRK-01 — Credential cutover + deprecation 410

**Ước lượng:** 4 ed · **Phụ thuộc:** TEN-03, SEC-02

### 3. Yêu cầu
- **R1:** Một store duy nhất `BrokerConnection` tenant-scoped. Bỏ mirror 2 store (`views_broker.py:68-81` đang mirror sang store legacy)
- **R2:** Route legacy trả **410 Gone** + header `Deprecation` + `Link` tới route mới
- **R3:** Metric `legacy_credential_usage` đếm số lần route legacy được gọi
- **R4:** Task sync đọc store **mới** (hiện `tasks.py:56-125` đọc store cũ)
- **R5:** **Không** drop store cũ — chỉ đánh dấu deprecated (D-30)

### 4. Tiêu chí nghiệm thu
- **AC1:** Gọi route legacy ⇒ 410 + header `Deprecation`
- **AC2:** `legacy_credential_usage` tăng sau mỗi lần gọi legacy
- **AC3:** Sync đọc store mới: đổi credential ở store mới thì sync dùng giá trị mới
- **AC4:** Store cũ vẫn còn nguyên vẹn (chưa drop)
- **AC5:** Task không còn đọc store cũ — grep 0 hit

### 5. Phản biện bắt buộc
- **PB1:** Có đường nào vẫn đọc store cũ không? Grep `DNSECredential` toàn repo — đếm số call site trước/sau.
- **PB2:** Credential cũ đã lưu sẽ tự dùng được sau cutover không? Nếu không có migration ⇒ tính năng hỏng với user cũ.

---

## BRK-02 — `secret_version` + rotate an toàn

**Ước lượng:** 3 ed · **Phụ thuộc:** SEC-02, BRK-01

### 3. Yêu cầu
- **R1:** Mọi credential mang `secret_version`
- **R2:** Rotate `BROKER_SECRET_KEY` không làm hỏng credential cũ
- **R3:** Re-encrypt theo lô (batch), có tiến độ, lỗi thì dừng
- **R4:** Nhật ký mỗi lần re-encrypt (không ghi giá trị)
- **R5:** Fail-closed nếu version không có trong keyring

### 4. Tiêu chí nghiệm thu
- **AC1:** Đổi key ⇒ credential version cũ vẫn giải mã được
- **AC2:** Re-encrypt lỗi giữa chừng ⇒ không để lại record hỏng (kiểm tra transaction)
- **AC3:** Audit có bản ghi cho mỗi lô

---

## BRK-03 — Capability matrix versioned

**Ước lượng:** 3 ed · **Phụ thuộc:** BRK-01 · **Theo D-16**

### 3. Yêu cầu
- **R1:** Capability matrix là **dữ liệu** có version, không phải hằng `FULLY_SUPPORTED` (`views_broker.py:31-32`)
- **R2:** Mỗi provider khai: `read_balance` · `read_positions` · `read_transactions` · `place_order` · `modify_order` · `cancel_order` · `stream_quotes`
- **R3:** Endpoint trả matrix + `version`
- **R4:** FE render đúng theo matrix (không hiện nút không dùng được)
- **R5:** SSI/TCBS phải phản ánh đúng: auth chưa hoàn chỉnh thì `read_*` = `false`

### 4. Tiêu chí nghiệm thu
- **AC1:** Matrix trả `version`
- **AC2:** SSI/TCBS không quảng bá `place_order` nếu chưa implement
- **AC3:** FE ẩn nút theo matrix — test với provider không có `place_order`
- **AC4:** Đổi version matrix ⇒ cache invalidate

### 5. Phản biện bắt buộc
- **PB1:** Đối chiếu từng capability với adapter thật trong `broker/adapters.py` — có khai sai không?
- **PB2:** Đọc code `broker/ssi.py:77-106` và `tcbs.py:68-87`: chỗ nào **thực sự** authenticate trước khi read?

---

## BRK-04 — Sync bất đồng bộ + reconciliation

**Ước lượng:** 5 ed · **Phụ thuộc:** SAFE-06, BRK-01

### 3. Yêu cầu
- **R1:** `SyncRun`: `tenant`, `broker_connection`, `sync_type`, `status`, `progress`, `started_at`, `finished_at`, `error`, `result_summary`
- **R2:** Sync chạy qua queue `broker`, view trả `202` + `sync_run_id`
- **R3:** `ReconciliationItem`: `sync_run`, `symbol`, `local_qty`, `broker_qty`, `local_amount`, `broker_amount`, `diff_type` (matched/quantity_mismatch/price_only/missing_local/missing_broker), `resolution` (auto/manual/pending)
- **R4:** **Không** ghi đè im lặng — mismatch tạo item, chờ quyết định
- **R5:** Giá chỉ lệch → auto-fix được (ghi nhận); **số lượng** lệch ⇒ luôn manual
- **R6:** Idempotent: chạy lại cùng khoảng thời gian không tạo bản ghi trùng
- **R7:** Endpoint đọc `SyncRun` có tenant scope

### 4. Tiêu chí nghiệm thu
- **AC1:** Gọi sync ⇒ `202` + `sync_run_id` trong < 500ms (đo)
- **AC2:** `SyncRun` đi qua đủ trạng thái; `progress` 0→100
- **AC3:** Chạy sync 2 lần cùng khoảng ⇒ không trùng
- **AC4:** Số lượng lệch ⇒ `pending`, **không** ghi đè
- **AC5:** Giá lệch ⇒ `auto` + ghi nhận
- **AC6:** Tenant A không đọc `SyncRun` của B
- **AC7:** Có bảng diff trong UI (SOC hoặc Broker Hub)

### 5. Phản biện bắt buộc
- **PB1:** Đo latency thật. Nếu > 500ms ⇒ AC1 fail.
- **PB2:** Worker chết giữa chừng ⇒ `SyncRun` kẹt ở `running` mãi? Có timeout/reaper không?
- **PB3:** DLQ có bản ghi để tra lại không, hay mất im lặng?

---

## BRK-05 — Chống SSRF `test-connection`

**Ước lượng:** 3 ed · **Phụ thuộc:** BRK-01

### 3. Yêu cầu
- **R1:** Validate host: chỉ allowlist domain broker đã biết — **không** nhận host tùy ý
- **R2:** Chặn IP private/loopback/link-local/metadata (`169.254.169.254`)
- **R3:** Chặn redirect ra ngoài allowlist
- **R4:** Timeout + giới hạn response size
- **R5:** Không log secret trong lỗi
- **R6:** Rate limit theo tenant + provider

### 4. Tiêu chí nghiệm thu
- **AC1:** Host ngoài allowlist ⇒ 422
- **AC2:** `127.0.0.1`, `10.x`, `192.168.x`, `169.254.169.254` ⇒ bị chặn (test từng loại)
- **AC3:** Redirect tới host ngoài allowlist ⇒ bị chặn
- **AC4:** Timeout ⇒ 504, không treo
- **AC5:** Rate limit: vượt ngưỡng ⇒ 429
- **AC6:** Lỗi không chứa secret

### 5. Phản biện bắt buộc
- **PB1:** Thử `http://169.254.169.254/latest/meta-data/` ⇒ có bị chặn không? Dán output.
- **PB2:** DNS rebinding: domain trong allowlist trỏ IP private — có kiểm tra IP sau resolve không?
- **PB3:** Còn endpoint nào khác nhận URL/host không? Grep toàn repo

---

## BRK-06 — SOC panel Broker Ops

**Ước lượng:** 3 ed · **Phụ thuộc:** BRK-03, BRK-04

### 3. Yêu cầu
- **R1:** Panel: tất cả connection, trạng thái, lần sync, `SyncRun` gần nhất
- **R2:** Reconciliation queue: bao nhiêu pending, ai phụ trách
- **R3:** Kill-switch toggle (operator, có capability)
- **R4:** Dùng `soc.module.css` token, không tạo hệ mới
- **R5:** i18n đầy đủ

### 4. Tiêu chí nghiệm thu
- **AC1:** Panel hiện đúng số connection/sync run
- **AC2:** Reconciliation queue đếm đúng
- **AC3:** Toggle kill-switch hoạt động + audit
- **AC4:** 0 hex hardcode
- **AC5:** axe 0 critical

---

# WAVE 5 — PAPER TRADING

> **Quyết định D-33:** dùng `VirtualBrokerEngine` của widget. **Không** viết `OrderTicketForm`/`ExecutionSimulator` mới.
> **Phương án PA-1:** sandbox độc lập, **KHÔNG** ghi ledger server.

## PAP-05 — Nâng widget `1.2.5` → `1.4.0` (làm TRƯỚC)

**Ước lượng:** 4 ed · **Phụ thuộc:** không · **File shared — giao cho MỘT agent duy nhất**

### 1. Mục tiêu
Nâng phiên bản widget theo D-32, **chốt contract bằng test trước**.

### 3. Yêu cầu
- **R1:** **Chốt contract bằng test trước khi nâng**: `getAnalytics()` shape · storage key `vnsc_*` · `TradingSyncSnapshot` · `PaperRuntimeConfig` defaults
- **R2:** Nâng pin `^1.2.5` → `^1.4.0` trong `packages/web/package.json`
- **R3:** Chạy GT1–GT5
- **R4:** Verify runtime: equity curve (`Line`+`Comparison`) · drawdown (`Area`) · monthly return (`Bar`) · K-line · paper order flow
- **R5:** Ghi lại **mọi khác biệt** tìm thấy sau nâng

### 4. Tiêu chí nghiệm thu
- **AC1:** Bảng "contract trước/sau" cho 4 điểm nêu trong R1 — **viết test chạy được, không chỉ đọc code**
- **AC2:** `npm ls vninvestcharts-widget` → 1.4.x
- **AC3:** GT1–GT5 xanh
- **AC4:** Runtime verify 5 mục, có ảnh chụp
- **AC5:** `test:components` 3 lần xanh
- **AC6:** FE bundle không tăng quá **+150 KB** gzipped — nếu vượt, báo và giải trình

### 5. Phản biện bắt buộc
- **PB1:** Có nào phá không? Chạy lại **toàn bộ** test chạm chart (stock detail, watchlist, heatmap) — không chỉ test portfolio
- **PB2:** Đo **bundle size** trước và sau. Nếu tăng lớn, lý do là gì?
- **PB3:** `packages/web/package.json` là **file shared**. Nếu agent khác đang sửa file này ⇒ **dừng**, báo coordinator.

### 10. Rollback
Revert `package.json` + `package-lock.json` về 1.2.5, build lại.

---

## PAP-01 — Tích hợp `VirtualBrokerEngine` + `pnlDisplayMode=net`

**Ước lượng:** 4 ed · **Phụ thuộc:** PAP-05, FE-01

### 1. Mục tiêu
Paper trading chạy, dùng engine widget, với **semantics khớp D-06**.

### 3. Yêu cầu
- **R1:** Mount `TradingProvider` + `TradingContext` của widget
- **R2:** **`pnlDisplayMode: "net"`** — mặc định widget là `"gross"`, lệch D-06 (D-34)
- **R3:** Giữ nguyên: `costBasisMethod: "average"` · `taxRate: 0.001` · `settlementDays: 2` · `allowShortSelling: false`
- **R4:** Vốn mặc định 1 tỷ VND (`DEFAULT_PAPER_BALANCE_VND`)
- **R5:** `PaperRuntimeConfig` lưu theo tenant+user (không dùng chung localStorage key)
- **R6:** **Paper không bao giỉ gọi broker thật** — fail-closed nếu có code path
- **R7:** Không ghi vào `Transaction`/`LedgerEntry` (PA-1)

### 4. Tiêu chí nghiệm thu
- **AC1:** `pnlDisplayMode` = `"net"` trong config đọc được từ app
- **AC2:** **1 case bán hàng có phí + thuế**: P&L net khớp **tính tay** — bảng số dán vào evidence
- **AC3:** `costBasisMethod` = `"average"`
- **AC4:** Lot 100 được chấp nhận; `quantity=150` cho VNM ⇒ bị từ chối
- **AC5:** Grep network call trong luồng paper ⇒ **0 hit** tới domain broker
- **AC6:** Paper trade **không** xuất hiện trong `Transaction` server (kiểm tra count DB)
- **AC7:** Config khác tenant không đọc lẫn nhau

### 5. Phản biện bắt buộc
- **PB1:** **Tính tay case AC2.** Widget dùng `commissionPerContract` hay `brokerFeeRate` cho lệnh cổ phiếu? Đọc `ExecutionSimulator.ts`. Nếu hai thuế cộng dồn sai ⇒ lệch D-06.
- **PB2:** AC5 kiểm tra bằng cách nào? Dùng network interceptor trong test, khẳng định 0 request tới broker. Dán output.
- **PB3:** `localStorage` key có phải `vnsc_paper` chung cho mọi user không? Nếu chung ⇒ user A đổi config user B cũng đổi. Đây là lỗi multi-tenant thật.

---

## PAP-02 — Mount `TradingDockPanel` vào Broker Hub

**Ước lượng:** 3 ed · **Phụ thuộc:** PAP-01

### 3. Yêu cầu
- **R1:** Mount `TradingDockPanel` / `ConnectedTradingDockPanel` — **không** viết form riêng
- **R2:** Nhãn "**PAPER**" hiển thị rõ, không nhầm với live
- **R3:** `TradingContext.mode` (`"live"|"replay"`) là **nguồn giá**, KHÔNG phải chế độ lệnh — ghi chú này phải lên UI/i18n
- **R4:** 5 tab panel: Orders · Positions · History · Trade History · Account
- **R5:** Export CSV dùng `csvExport.ts` của widget
- **R6:** i18n VI/EN
- **R7:** Tab paper chỉ hiện với capability `workspace.portfolio.paper`

### 4. Tiêu chí nghiệm thu
- **AC1:** 5 tab hiển thị và chuyển được
- **AC2:** Nhãn PAPER xuất hiện ở header panel
- **AC3:** Place order qua UI được, khớp `VirtualBrokerEngine`
- **AC4:** Positions cập nhật sau fill
- **AC5:** Export CSV có BOM
- **AC6:** Không có capability ⇒ ẩn tab
- **AC7:** axe 0 critical

### 5. Phản biện bắt buộc
- **PB1:** Người dùng có nhầm "PAPER" với lệnh thật không? **Chụp ảnh panel**, hỏi: nếu là người dùng thật, có hiểu không?
- **PB2:** Panel có tràn layout ở 1280px không?

---

## PAP-03 — Chặn market chưa phân loại (crypto)

**Ước lượng:** 2 ed · **Phụ thuộc:** PAP-01 · **Theo D-35**

### 3. Yêu cầu
- **R1:** Gọi `isUnclassifiedMarketSymbol()` (`MarketRules.ts:126`) **trước** khi đưa symbol vào paper engine
- **R2:** Blocked ⇒ thông báo rõ lý do, **không** âm thầm dùng `VN_SPOT`
- **R3:** Lý do: crypto rơi vào `VN_SPOT` ⇒ áp lot 100 + T+2 ⇒ định giá sai
- **R4:** Cùng guard cho `MarketProfileType` (`VN_DERIVATIVES` / `GLOBAL_MARGIN`)

### 4. Tiêu chí nghiệm thu
- **AC1:** Symbol crypto (`BTCUSDT`, `ETHUSDT`) ⇒ bị chặn, có message
- **AC2:** Symbol chưa biết (không thuộc allowlist) ⇒ chặn
- **AC3:** Symbol VN hợp lệ (VNM, HPG) ⇒ qua
- **AC4:** Test chứng minh nếu **bỏ** guard thì BTC bị áp lot 100 — dán output 2 lần (có guard / không guard)

### 5. Phản biện bắt buộc
- **PB1:** AC4 là **negative test** — bắt buộc chứng minh guard có tác dụng. Chạy và dán.
- **PB2:** Allowlist symbol lấy từ đâu? Nếu hardcode ⇒ symbol mới niêm yết không dùng được.

---

## PAP-04 — Plan gating + paper không gọi broker thật

**Ước lượng:** 3 ed · **Phụ thuộc:** PAP-01, SAFE-04

### 3. Yêu cầu
- **R1:** Capability `workspace.portfolio.paper` theo plan (FREE trở lên)
- **R2:** Feature flag `BROKER_INTEGRATION_ENABLED` (D-21) tắt mặc định
- **R3:** **Fail-closed:** bất kỳ code path nào từ paper tới broker thật đều bị chặn
- **R4:** Audit event `paper.order.placed`
- **R5:** Không có đường nào để bật live từ UI paper

### 4. Tiêu chí nghiệm thu
- **AC1:** Không capability ⇒ 403
- **AC2:** Thiếu feature flag ⇒ paper chạy, live không
- **AC3:** Network test: 0 request tới domain broker trong toàn bộ luồng paper
- **AC4:** Audit có bản ghi
- **AC5:** Grep không tìm thấy chỗ nào bật live từ UI paper

---

# WAVE 6 — LIVE TRADING

> **Lưu ý:** D-21 đã chốt — `vnbroker` là sở hữu của chủ repo ⇒ **không còn blocker pháp lý**. Slice này vẫn cần đủ gate kỹ thuật.

## LIV-01 — Live gates

**Ước lượng:** 4 ed · **Phụ thuộc:** Wave 5, SAFE-01, SAFE-03, SAFE-04

### 3. Yêu cầu
- **R1:** Live order đi qua **đủ** các gate: kill-switch · capability · risk limit · Idempotency-Key · mode approval
- **R2:** Thiếu **bất kỳ** gate nào ⇒ từ chối
- **R3:** Feature flag + tenant allowlist cho live
- **R4:** Audit **mọi** lần gọi broker, kể cả thành công
- **R5:** Không có đường live không qua approval

### 4. Tiêu chí nghiệm thu
- **AC1:** Tắt từng gate một ⇒ order bị chặn (test từng gate, **7 lần**)
- **AC2:** Đủ gate ⇒ order đi thành công
- **AC3:** Audit đầy đủ cả thành công lẫn thất bại
- **AC4:** Grep không có đường live nào bỏ qua gate

### 5. Phản biện bắt buộc
- **PB1:** Chạy **7 test tắt từng gate** — dán bảng kết quả.
- **PB2:** Có race giữa kiểm tra gate và gọi broker không? Gate TOCTOU.

---

## LIV-02 — Order modify/cancel + `OrderEvent`

**Ước lượng:** 4 ed · **Phụ thuộc:** LIV-01, LED-06

### 3. Yêu cầu
- **R1:** Model `Order` + `OrderEvent` (vòng đời)
- **R2:** Modify/cancel có `Idempotency-Key`
- **R3:** Mọi chuyển trạng thái ghi 1 `OrderEvent`
- **R4:** Terminal state không đổi được
- **R5:** Cancel đã filled ⇒ 409
- **R6:** `OrderEvent` append-only

### 4. Tiêu chí nghiệm thu
- **AC1:** Vòng đời đầy đủ ghi event
- **AC2:** Cancel sau filled ⇒ 409
- **AC3:** Modify sau terminal ⇒ 409
- **AC4:** Terminal state bất biến (test mọi transition)
- **AC5:** Trùng Idempotency-Key modify ⇒ không đổi 2 lần

---

## LIV-03 — `RiskLimit` + enforcement

**Ước lượng:** 5 ed · **Phụ thuộc:** LIV-02 · **Deny by default**

### 3. Yêu cầu
- **R1:** `RiskLimit`: `tenant`, `scope` (global/tenant/user/symbol), `max_order_value`, `max_daily_value`, `max_position_weight`, `max_daily_orders`, `enabled`
- **R2:** **Không có limit ⇒ deny** (Deny by default, không phải allow)
- **R3:** Kiểm tra trước khi gửi broker
- **R4:** Vượt ⇒ 422 + nêu rõ limit nào vi phạm
- **R5:** Đếm `max_daily_orders` theo ngày VN
- **R6:** Operator đặt limit trong SOC

### 4. Tiêu chí nghiệm thu
- **AC1:** Vượt từng loại limit ⇒ 422 với đúng tên limit
- **AC2:** **Không có `RiskLimit` ⇒ order bị chặn** (test bằng cách xoá limit)
- **AC3:** `max_daily_orders` reset đúng 00:00 giờ VN
- **AC4:** Kiểm tra limit chạy **trước** khi gọi broker — spy xác nhận broker không được gọi khi vượt
- **AC5:** Operator đặt limit qua SOC có hiệu lực ngay

### 5. Phản biện bắt buộc
- **PB1:** **AC2 là quan trọng nhất.** Mặc định phải là chặn, không phải cho. Test bằng cách xoá hết limit rồi thử đặt lệnh.
- **PB2:** Đặt limit ở scope nào thắng khi trùng? Ghi rõ thứ tự ưu tiên.
- **PB3:** Limit có bị race khi 2 tab cùng đặt không?

---

## LIV-04 — Canary release

**Ước lượng:** 4 ed · **Phụ thuộc:** LIV-03

### 3. Yêu cầu
- **R1:** Bật live lần lượt: 1 user → 10% → 100%
- **R2:** Mỗi bước cần **approval bằng văn bản**
- **R3:** Auto-rollback khi: lỗi tăng, duplicate order, audit thiếu
- **R4:** Dashboard theo dõi: tỉ lệ thành công, độ trễ, từ chối
- **R5:** Rollback tức thời được

### 4. Tiêu chí nghiệm thu
- **AC1:** Chỉ đúng tỉ lệ user được bật
- **AC2:** Auto-rollback chạy đúng ngưỡng
- **AC3:** Rollback đóng live trong < 60s
- **AC4:** Dashboard số liệu đúng

---

## LIV-05 — DR drill

**Ước lượng:** 4 ed · **Phụ thuộc:** LIV-04

### 3. Yêu cầu
- **R1:** Backup tự động + PITR
- **R2:** Runbook khôi phục có sẵn
- **R3:** **Drill thật** — không chỉ viết tài liệu
- **R4:** Đo RTO/RPO
- **R5:** Ghi báo cáo drill

### 4. Tiêu chí nghiệm thu
- **AC1:** Restore thành công từ backup
- **AC2:** RTO/RPO đo được, ghi vào báo cáo
- **AC3:** Mất dữ liệu sau crash ≤ RTO đã cam kết
- **AC4:** Báo cáo drill có timestamp + người chạy

---

# WAVE 7 — HARDENING

## OPS-01 — SLO + error budget + alert

**Ước lượng:** 4 ed · **Phụ thuộc:** Wave 6 · **D-18**

### 3. Yêu cầu
- **R1:** 5 SLO đo được: read p95 ≤ 500ms · sync freshness p95 ≤ 30 phút · duplicate order = 0 · audit completeness 100% · isolation violation = 0
- **R2:** Error budget theo Google SRE
- **R3:** Alert khi burn rate vượt ngưỡng
- **R4:** Dashboard hiện burn rate

### 4. Tiêu chí nghiệm thu
- **AC1:** Cả 5 SLO có metric thật
- **AC2:** Đo được baseline (in số)
- **AC3:** Alert kích hoạt khi vượt (test bằng cách phá có chủ đích rồi ghi nhận)
- **AC4:** DORA 4 metric theo dõi

---

## OPS-02 — Load test 1000 user

**Ước lượng:** 3 ed · **Phụ thuộc:** OPS-01

### 4. Tiêu chí nghiệm thu
- **AC1:** 1000 concurrent ⇒ p95 ≤ 500ms (in đồ thị + số)
- **AC2:** Không rò rỉ connection
- **AC3:** Không lỗi 5xx > 0.1%
- **AC4:** Báo cáo kèm cấu hình môi trường

### 5. Phản biện bắt buộc
- **PB1:** Môi trường test có giống production không (CPU, RAM, DB)? Nếu nhỏ hơn thì số không đại diện.
- **PB2:** Cache ấm hay nguội khi đo? D-18 nói "warm" — ghi rõ điều kiện.

---

## OPS-03 — Backup/restore + PITR

**Ước lượng:** 3 ed · **Phụ thuộc:** không

### 4. Tiêu chí nghiệm thu
- **AC1:** Backup tự động chạy đúng lịch
- **AC2:** PITR hoạt động
- **AC3:** Restore thử thành công
- **AC4:** Ledger 7 năm không bị cắt (D-17)

---

## OPS-04 — ASVS 5.0 L2 + pen test

**Ước lượng:** 5 ed · **Phụ thuộc:** Wave 6

### 3. Yêu cầu
- **R1:** Checklist ASVS 5.0 **L2 đầy đủ** — mọi mục pass
- **R2:** OWASP API Top 10 2023 — 10/10 dòng có biện pháp + test
- **R3:** Pen test độc lập
- **R4:** Sửa hết finding P0/P1 trước khi ký release

### 4. Tiêu chí nghiệm thu
- **AC1:** ASVS L2: **0 mục fail**
- **AC2:** API Top 10: 10/10 dòng có bằng chứng
- **AC3:** Báo cáo pen test có sẵn
- **AC4:** 0 finding P0/P1 chưa đóng

### 5. Phản biện bắt buộc
- **PB1:** Đếm số mục ASVS đánh dấu "pass" nhưng **không có bằng chứng** → hạ xuống "chưa kiểm chứng".
- **PB2:** Pen test có độc lập thật không, hay chính tác giả tự chấm?

---

## OPS-05 — Retention policy

**Ước lượng:** 2 ed · **Phụ thuộc:** LED-01 · **D-17**

### 4. Tiêu chí nghiệm thu
- **AC1:** Ledger/order/audit giữ ≥ 7 năm
- **AC2:** Cache/snapshot xoá sau 90 ngày
- **AC3:** Job log xoá sau 30 ngày
- **AC4:** Job xoá chạy đúng lịch, có log

---

## OPS-06 — SBOM CycloneDX ≥1.6

**Ước lượng:** 2 ed · **Phụ thuộc:** không

### 4. Tiêu chí nghiệm thu
- **AC1:** `sbom.json` valid theo schema CycloneDX 1.6+
- **AC2:** Có cả BE lẫn FE
- **AC3:** Sinh được trong CI
- **AC4:** Có vulnerability scan kèm

---

## OPS-07 — ISO 27001 evidence pack

**Ước lượng:** 3 ed · **Phụ thuộc:** OPS-04

### 4. Tiêu chí nghiệm thu
- **AC1:** Risk register có
- **AC2:** Access control matrix (RBAC) tài liệu hóa
- **AC3:** Change management record (PR history)
- **AC4:** Incident response runbook

---

## Checklist đóng Wave 7 — Điều kiện go-live

- [ ] ASVS 5.0 L2: 0 mục fail, **mọi mục pass có bằng chứng**
- [ ] OWASP API Top 10: 10/10 dòng
- [ ] Pen test độc lập, 0 finding P0/P1
- [ ] 5 SLO đo được + baseline + alert
- [ ] Load test: 1000 concurrent, p95 ≤ 500ms
- [ ] Restore thử thành công, RTO/RPO đo được
- [ ] Retention đúng D-17
- [ ] SBOM valid
- [ ] ISO 27001 evidence đầy đủ
- [ ] `test:components` 3 lần xanh (D-19)
- [ ] Secret scan 0 hit
- [ ] `docs/evidence/*/audit.md`: 0 lỗi, confidence high

---

## Phụ lục — Ước lượng tổng

| Wave | Slice | ed min | ed max |
|------|-------|--------|--------|
| −1 Security | 3 | 4 | 6 |
| 0 Safety | 7 | 24 | 30 |
| 1 Tenant | 6 | 21 | 28 |
| 2 Ledger + Analytics | 12 | 30 | 38 |
| 3 API + FE | 10 | 33 | 42 |
| 4 Broker | 6 | 24 | 31 |
| 5 Paper | 5 | 16 | 22 |
| 6 Live | 5 | 21 | 28 |
| 7 Hardening | 7 | 19 | 26 |
| **TỔNG** | **61** | **192** | **251** |

Với **4 agent song song** (1 mỗi wave trước, 2 agent wave 2–3) và không có blocker: **5–6 tháng**.

---

## Phụ lục — Bảng chống quên

| Bẫy đã gặp thật | Slice liên quan | Phòng tránh |
|------------------|-----------------|-----------|
| BE test trên SQLite → `array_agg` lỗi | Tất cả BE slice | GT14 — Postgres riêng |
| Gate qua pipe → không bao giờ fail | SAFE-07 | Capture exit code |
| Migration trùng số | TEN-05, LED-01..06 | Serialize, để tool sinh số |
| `print()` tiếng Việt → `UnicodeEncodeError` | TEN-05, LED-05 | Dùng `logger` |
| Chạy gate trước khi rebase | Mọi slice | `agent-sync.ps1` rồi mới gate |
| Báo PASS cho gate chưa chạy | Mọi slice | `CHƯA CHẠY` hợp lệ |
| `pnlDisplayMode` gross ≠ net | PAP-01 | Set `net` + test tay |
| Map `value` thay `close` | FE-02, FE-05 | Test contract |
| Crypto vào `VN_SPOT` | PAP-03 | Guard + negative test |
| Test theo giờ thật | ANA-05 | Mock clock |
| `localStorage` chung multi-tenant | PAP-01 | Key theo tenant+user |
| Đọc file UTF-8 qua console cp1252 ⇒ finding mojibake giả | Mọi audit | Đọc bằng tool biết encoding |

---

*Hết. Bộ tài liệu kế hoạch thực thi gồm 4 file:*
1. `docs/PORTFOLIO_EXEC_PLAN_MASTER_20260927.md`
2. `docs/PORTFOLIO_EXEC_SLICES_SEC_SAFE_TENANT_20260927.md`
3. `docs/PORTFOLIO_EXEC_SLICES_LEDGER_FE_20260927.md`
4. `docs/PORTFOLIO_EXEC_SLICES_BROKER_LIVE_OPS_20260927.md`
