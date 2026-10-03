# Kế hoạch xây dựng Quản lý Broker (SSI/TCBS/DNSE) — User-level + System-level

- **Ngày**: 2026-09-23 — Trạng thái: **chờ phê duyệt**
- **Audit nền**: `docs/AUDIT_BROKER_MANAGEMENT_20260923.md` (10 findings, 5 contradictions)
- **Tham chiếu thương mại**: TradingView — 100+ brokers tích hợp, Trading Panel, Order Ticket,
  Account Manager, Paper Trading (`tradingview.com/trading`, `/broker-api-docs`, `/charting-library-docs/.../implement-broker-api`).

## 1. Tóm tắt đề xuất (đọc để quyết)

Hôm nay app đã **đặt được lệnh tiền thật DNSE** (`views_dnse.py:214-255` + `DNSEConnectionPanel.js:190-225`)
nhưng ở dạng thô: đơn-broker, không audit, không phân quyền gói, gọi đồng bộ trong request.
Trong khi đó vnbroker v3.x đã có sẵn **3 lane production** (TCBS iFlash ~50 methods, SSI native ~45 methods
+ 7 lệnh điều kiện FCO + WebSocket, DNSE ~30 methods) mà vninvest dùng **0 dòng** cho TCBS/SSI.

Đề xuất: xây **Trung tâm Môi giới (Broker Hub)** 2 tầng — User-level (kết nối TK, xem Gomes, đặt lệnh,
giấy) theo đúng mô hình TradingView đã chứng minh giữ chân user; System-level (SOC giám sát, audit,
hạn mức, credential vault) để giao dịch tiền thật an toàn và đối soát được. Đi theo pha, pha đầu
(G0) chỉ **cứng hóa cái đang chạy** (async + audit + plan-gate), chưa thêm broker mới — rủi ro thấp,
giá trị ngay (hết treo request, có nhật ký lệnh).

**Vì sao đáng làm**: SSI + TCBS chiếm đa số thị phần môi giới VN — user của 2 nhà này hôm nay không có lý do
gắn bó tài khoản với app; TradingView chứng minh broker-integration là tính năng giữ chân và upsell
(Subscriptions của họ độc lập với phí broker — đúng mô hình FREE/PRO của ta). Nền đa-broker đã có một nửa
(`SubAccount.broker_source`, `AccountSnapshot`, `UnifiedRegistry`, `broker/security/*`) nên chi phí thấp hơn
xây mới hoàn toàn.

## 2. Mục tiêu & nguyên tắc cứng

- **M1**: Mọi write tiền thật đi qua hàng đợi + audit đầy đủ (ai, khi nào, broker nào, lệnh gì, kết quả).
- **M2**: Một UX kết nối duy nhất cho 3 broker (như TradingView Trading Panel), không 3 panel rời.
- **M3**: Không stub/giả dữ liệu (kế thừa `tasks.py:4-8`); lỗi broker phải fail rõ, không ghi DB nửa vời.
- **M4**: Secret không bao giờ qua log/response (kế thừa `dnse_credential_views.py:93-97` preview `****` + `broker/security/redaction.py`).
- **M5**: `dry_run=True` mặc định mọi write mới (kế thừa `broker/tcbs/client.py:333-433`, `broker/ssi/client.py:758`).
- **M6**: Chuẩn repo: glassmorphism/SOC tokens, i18n full VI/EN qua LangContext, `tsc` + `build` xanh mỗi sub-step,
  `npm run i18n:scan` 0 key thiếu, test mới cho mọi endpoint broker.

## 3. Ma trận credential & auth theo broker (từ code vnbroker — dùng để thiết kế form kết nối)

| Broker | Secret cần lưu (Fernet) | Flow xác thực mỗi lần dùng | Token TTL / lưu ý | Nguồn |
|---|---|---|---|---|
| DNSE (giữ) | `client_id` + `client_secret` (đã có) | Bearer từ LightSpeed; trade cần email-OTP → trading token | Trading token ngắn hạn, phải tạo lại mỗi phiên | `connector/dnse/client.py:264-278`, `views_dnse.py:258-316` |
| SSI (mới) | `client_id` + `api_key` + `api_secret` + `private_key` (RSA ký lệnh) | market-only không OTP (xem giá/OHLC) → OTP/Smart-OTP-push khi trade; `refresh()` gia hạn | `set_token_manual`, `ensure_authenticated` | `broker/ssi/auth.py:42-261`, `client.py:128-167`, `docs/SSI_USAGE_GUIDE.md` |
| TCBS (mới) | `api_key` (+ `custody_code` optional) | OTP mỗi lần `authenticate(otp)` → JWT Bearer | `is_token_valid/revoke` | `broker/tcbs/auth.py:30-148`, `client.py:94-118` |

Kết luận thiết kế: form kết nối có 2 bước chung — **B1 lưu secret** (mã hóa, test-connection read-only) →
**B2 phiên giao dịch** (OTP → token, hiển thị TTL, nút ngắt). SSI thêm chế độ "chỉ xem thị trường"
không OTP là lợi thế UX (xem sức mua/OHLC trước khi quyết trade).

## 4. Kiến trúc đề xuất

### 4.1 Backend — trừu tượng hóa đa-broker (học TradingView Broker API)

```
FE Broker Hub ──► /api/broker/<provider>/... ──► BrokerAdapter (interface chung)
                                                        ├── DnseAdapter (có sẵn: dnse_adapter.py + compat)
                                                        ├── SsiAdapter (mới, wrap SSIBrokerClient)
                                                        └── TcbsAdapter (mới, wrap TCBSBrokerClient)
                         ┌─ read path: accounts/balances/positions/orders → normalize → SubAccount/Transaction/AccountSnapshot
                         └─ write path: validate → plan-gate → hạn mức → Celery job → idempotency_key → audit → poll
```

- **`BrokerCredential`** (mới, thay 2 model DNSE song song — Audit F4): `user FK, provider (dnse|ssi|tcbs),
  label, secrets_cipher JSON (Fernet), status (connected/expired/error), last_sync_at, last_error`.
  Migration: copy dữ liệu từ `user_workspace.DNSECredential` + `identity_access.UserDNSECredential`,
  giữ bảng cũ read-only 1 release rồi drop.
- **Normalized DTOs** (chuẩn TradingView `orders/positions/executions/accountManagerInfo`):
  `BrokerAccount{external_id,display,type}`, `BrokerPosition{symbol,qty,avg_price,market_price,pnl}`,
  `BrokerOrder{id,symbol,side,type,price,qty,status,placed_at}`, `BrokerBalance{cash,stock_value,debt,nav,buying_power}`.
  Mỗi adapter map tường minh (học `portfolio_snapshot` của SSI, `client.py:278`).
- **Write pipeline** (fix F1+F2): `POST .../orders/` chỉ tạo `BrokerOrderJob{PENDING}` + `idempotency_key`
  (tái dùng `broker/security/idempotency.py`) → Celery worker gọi vnbroker (`dry_run` trừ khi user xác nhận 2 bước) →
  `ops_audit` ghi `broker.order.placed/modified/cancelled` (mở rộng audit) → FE poll trạng thái.
- **Read pipeline**: `.delay()` fan-out theo lịch (tái dùng `tasks.py:34-47` + thêm beat `sync_all_ssi/tcbs_*`);
  sync viết `sync_status{last_sync_at,source,error}` (pattern `tasks.py:108-112`).

### 4.2 Frontend — Broker Hub (học TradingView Trading Panel + Order Ticket)

- **Broker Hub** (trang mới trong Tài sản, cạnh Sổ giao dịch/Danh mục): danh sách broker tiles
  (DNSE/SSI/TCBS + trạng thái connected/expired) → Connect (B1/B2 theo §3) → **Account Manager**
  (tabs: Vị thế | Sổ lệnh | Lịch sử khớp | Số dư — đúng 4 tabs TradingView) → chuyển TK đa-broker trong một hub.
- **Order Ticket chuẩn** (thay `DNSEConnectionPanel.js:190-225`): chọn TK → symbol (tìm kiếm, không gõ tay) →
  loại lệnh (LO/MP/ATC/ATO; SSI thêm FCO điều kiện) → giá/KL (validate lô 100, bước giá) →
  **preview sức mua + phí dự kiến** → xác nhận 2 bước → job-polling trạng thái → toast + ghi Sổ lệnh.
  Sửa/hủy lệnh từ Sổ lệnh (TradingView `modifyOrder/cancelOrder` — DNSE đã có `put_order/cancel_order`,
  SSI/TCBS có `modify/cancel` sẵn).
- **Chart trading (P3)**: nút Mua/Bán trên StockDetail + kéo-thả sửa lệnh (TradingView order-modify-by-dragging);
  cần `isTradable(symbol)` theo broker đã nối.
- **Paper Trading (P3)**: tài khoản ảo 100M, cùng Order Ticket nhưng engine nội bộ (không gọi broker),
  bảng xếp hạng P&L — vũ khí onboarding + upsell PRO, 0 rủi ro tiền thật.
- **Chuẩn UI**: glassmorphism, tokens `soc`/`settings`, i18n full (sửa nợ hardcode VI của panel DNSE),
  gộp adapter FE thành `adapters/core/broker{DNSE,SSI,TCBS}.js` (fix F9).

### 4.3 System-level — SOC Broker Ops (staff-only)

- Tab SOC mới **Broker Ops**: sức khỏe lane theo broker (latency, tỉ lệ lỗi, retry), hàng đợi job broker,
  top lỗi, credential sắp hết hạn/token fail, nút **kill-switch** ngắt write toàn hệ thống khi sự cố.
- Audit viewer: lọc theo user/broker/order-id, export CSV (pattern `SocExportRunLogsView`).
- Quota & policy: hạn mức lệnh/ngày theo plan (FREE: 0 write / chỉ paper; PRO: N lệnh; Enterprise: custom),
  quiet-hours ngoài phiên, cảnh báo khi broker đổi API (contract test đỏ).
- Runbook `docs/BROKER_RUNBOOK_*`: OTP, token TTL, giờ GD, dry-run verify, rollback pin vnbroker.

## 5. Đối chiếu TradingView (parity checklist — dùng nghiệm thu từng pha)

| # | TradingView | Hôm nay (vninvest) | Kế hoạch |
|---|---|---|---|
| T1 | Trading Panel + broker tiles + Connect | DNSE-only, rời rạc (Settings + Portfolios) | Broker Hub (U1) |
| T2 | positions/orders/history/balances tabs | Có DNSE (sync tay), 0 SSI/TCBS | Account Manager đa-broker (U1→P1/P2) |
| T3 | Order Ticket + brackets + preview | Text-input thô, cứng STOCK/NORMAL | Order Ticket chuẩn + preview sức mua/phí (U2) |
| T4 | modify/cancel, drag-to-modify | 0 (dù lib đã có) | Sổ lệnh sửa/hủy + chart trading (U2/U3) |
| T5 | Conditional orders (stop/trailing/OCO) | 0 | SSI FCO 7 loại (P1+) — differentiator |
| T6 | Paper Trading | 0 | Paper engine (P3) |
| T7 | Multi-broker/account switching | 0 | Hub + `currentAccount` (U1) |
| T8 | Real-time positions/P&L, streaming | Snapshot theo lần bấm | Beat sync + SSI/TCBS WS (P3/S2) |
| T9 | Broker health/tests trước deploy | 0 | Contract tests + SOC Broker Ops (G0/S1) |

## 6. Roadmap pha (mỗi pha có DoD đo được)

### G0 — Hardening DNSE đang chạy (P0, ~5 ngày, LÀM TRƯỚC — không cần phê duyệt broker mới)
- G0.1 Async hóa 3 view sync (`views_dnse.py:144,174,204` → `.delay()` + `GET broker/jobs/<id>/` poll) + timeout/retry chuẩn Celery.
- G0.2 Audit mọi write DNSE vào `ops_audit` (placed/modified/cancelled + OTP/token events) + export CSV.
- G0.3 Plan-gate: write yêu cầu plan trả phí (`helpers.py:137-150` mở rộng thêm `broker:trade`), FREE chỉ xem + paper sau này.
- G0.4 Hạn mức: N lệnh/ngày/user (config), idempotency_key chống double-submit, confirm 2 bước ở FE.
- G0.5 Contract test pin signature `DNSEClient` (F7) + runbook + i18n EN cho panel DNSE.
- **DoD**: E2E đặt lệnh DNSE qua job (không block), audit đủ 5 fields, FREE bị chặn write với message chuẩn,
  `tsc` 0, `build` PASS, `i18n:scan` 0, tests mới ≥ 12 BE + 4 FE xanh.

### P1 — SSI lane (P0 thương mại, ~10-12 ngày, cần bump vnbroker → v3.2.0+)
- D1 `BrokerCredential` đa-broker + migrate 2 store DNSE (giữ alias cũ 1 release).
- D2 `SsiAdapter`: connect (B1/B2, Smart-OTP poll), `list_accounts/balance/ppmmr/holdings/orders/history/portfolio_snapshot`.
- D3 Sync SSI → SubAccount (`broker_source="SSI"`) + balances + reconcile (tái dùng pattern `tasks.py:50-260`) + beat.
- D4 Write SSI qua job pipeline (place/modify/cancel + 1 FCO GTD trước, mở dần 7 loại) + `enable_write()` gate.
- U1 Broker Hub + Account Manager (SSI + DNSE) + Order Ticket chuẩn (LO/MP/ATC/ATO) + Sổ lệnh sửa/hủy.
- **DoD**: user SSI thật connect → xem vị thế/sổ lệnh/sức mua → đặt-hủy 1 lệnh GTD dry-run→live (có audit),
  parity T1–T4,T7 cho SSI.

### P2 — TCBS lane (~8-10 ngày)
- `TcbsAdapter` (api_key + OTP → JWT, `is_token_valid` refresh), sync accounts/balance/holdings/orders/executions,
  write LO + stop-limit qua job pipeline; Hub thêm tile TCBS; parity T1–T4,T7 cho TCBS.
- **DoD** tương tự P1 trên tài khoản TCBS thật (sandbox nếu có).

### P3 — Thương mại hóa (~12-15 ngày)
- U3 Chart trading (Mua/Bán + kéo sửa lệnh) trên StockDetail; U4 NAV/P&L chart từ `AccountSnapshot` + beat;
  Paper Trading engine + bảng xếp hạng; WS realtime (SSI stream/DNSE websocket) cho Account Manager.
- Monetization: FREE = xem + paper; PRO = trade thật + FCO; Enterprise = multi-account + API.
- **DoD**: parity T5,T6,T8; funnel Connect→Trade đo được; docs + video hướng dẫn.

### S1 — SOC Broker Ops (song song từ G1, ~6-8 ngày, staff-only)
- Health lane/broker, queue depth jobs broker, top lỗi, credential expiry, kill-switch write, audit viewer + CSV,
  contract-test dashboard khi bump vnbroker. Tái dùng `SocVnbrokerPanel` pattern + `soc.*` i18n.

## 7. Delta triển khai (để estimate không vỡ)

- **Migrations**: `BrokerCredential` (mới), `BrokerOrderJob` (mới: idempotency_key unique, status, payload, result),
  mở rộng `SubAccount` (thêm `provider_account_type` — có thể tái dùng `type`), `ops_audit` event types mới.
  Dữ liệu DNSE cũ migrate script + verify count 2 chiều.
- **BE files chạm**: `user_workspace/{models,views_dnse,tasks,urls,serializers,vnbroker_dnse_compat}` (mở rộng),
  mới `user_workspace/broker/{base,dnse,ssi,tcbs}.py` + `views_broker.py`, `identity_access/views/helpers.py`
  (abilities `broker:trade`), `service_ops` (Broker Ops), `commercial` (quota theo plan).
- **FE files chạm**: mới `pages/BrokerHubPage*` + `components/broker/*` (tiles, AccountManager, OrderTicket, Paper),
  gộp `adapters/core/broker*.js`, i18n `broker.*` VI/EN (~60 keys), StockDetail nút trade (P3).
- **vnbroker**: bump `requirements.txt:29` `@v1.1.0 → @v3.2.0+` (SSI) — theo
  `docs/NGHIEN_CUU_VNBROKER_NANG_CAP_20260923.md` Phase 1–2 (tag/release trước khi bump).
- **Infra**: worker queue `broker` riêng (tách khỏi default để lệnh không kẹt sau ingest),
  beat sync ngoài phiên + quiet-hours, secret Fernet key rotation doc.

## 8. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Tiền thật sai/lặp lệnh | P0 | Idempotency key + confirm 2 bước + `dry_run` mặc định + hạn mức/ngày + kill-switch |
| Secret broker lộ/lọt log | P0 | Fernet at-rest, preview `****`, Redactor, không trả secret qua API, rotation runbook |
| Broker đổi API (đã từng: DNSE compat) | P1 | Contract tests pin signature + SOC health + pin SHA tag vnbroker |
| OTP/token mệt UX (DNSE mỗi phiên) | P1 | Lưu phiên + hiển thị TTL + nhắc gia hạn; SSI market-only không OTP để xem trước |
| Pháp lý (khuyến nghị đầu tư + đặt lệnh hộ) | P1 | Disclaimer bắt buộc trước khi bật trade; log consent; chỉ user tự đặt trên TK của mình |
| Treo giờ cao điểm | P1 | Mọi I/O broker qua Celery + timeout + circuit-breaker (kế thừa HealthStore pattern) |
| Scope creep (7 FCO, phái sinh, WS ngay) | P2 | P1 chỉ GTD + cơ bản; FCO còn lại + phái sinh vào P3 khi nhu cầu rõ |

## 9. Monetization đề xuất (gắn với plan hiện tại)

- **FREE**: kết nối xem (read-only) + Paper Trading — acquisition funnel, 0 rủi ro tiền.
- **PRO** (500k/6 tháng theo `plan_catalog.py:25,32`): trade thật + lệnh điều kiện + NAV/P&L + realtime.
- **Enterprise**: multi-account, phân quyền member trade (TenantMember roles), API/PAT cho trade, audit xuất SIEM.
- Chỉ số thành công: % user PRO nối ≥1 broker, lệnh/tuần, tỉ lệ lỗi lệnh, thời gian Connect→first-trade, churn PRO có broker vs không.

## 10. Xin phê duyệt (quyết định cần anh/chị)

1. **Phạm vi tiền thật**: chỉ xem (read-only) hay cho đặt/sửa/hủy thật từ G0/P1? (Đề xuất: cho, nhưng qua pipeline G0.)
2. **Plan-gate**: write chỉ PRO+ (đề xuất) hay mở FREE?
3. **Thứ tự**: SSI trước (đề xuất — FCO là vũ khí) hay TCBS trước?
4. **Secret**: Fernet trong DB (đề xuất G0–P2) hay vault ngoài ngay từ đầu?
5. **Paper Trading**: làm cùng P1 (tăng onboarding) hay để P3?
6. **Phê duyệt G0 (~5 ngày) + P1 (~10-12 ngày)** để khởi động; P2/P3/S1 chốt sau khi G0 xong.

*Chuẩn bị bởi audit 2026-09-23. Mọi con số file:line đã verify trong `docs/AUDIT_BROKER_MANAGEMENT_20260923.md`.*
