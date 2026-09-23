Ca# AUDIT: Quản lý Broker (SSI/TCBS/DNSE) — Hiện trạng vninvest × vnbroker v3.x

- **Ngày**: 2026-09-23 — Loại: audit + đối chiếu plan↔code (không đổi code)
- **Phạm vi**: `packages/core/backend/src/{user_workspace,identity_access,service_ops,commercial,ops_audit}` +
  `packages/web/src/{components/DNSE*,adapters/core,i18n,pages}` +
  `C:\Mujoco Projects\vnbroker/{broker/{tcbs,ssi},brokerage/tcbs,connector/dnse,docs}`
- **Tham chiếu thương mại**: TradingView Broker Integration (Trading Panel, Order Ticket, Account Manager,
  Paper Trading, multi-broker/account switching) — `tradingview.com/broker-api-docs`,
  `tradingview.com/charting-library-docs/.../implement-broker-api`, `tradingview.com/trading`.

## 5 findings nghiêm trọng nhất (đọc trước)

1. **[F1-CRIT] View gọi Celery task đồng bộ trong request**: `views_dnse.py:144,174,204` gọi trực tiếp
   `sync_dnse_accounts_task(user.id)` / `sync_dnse_balances_task` / `reconcile_dnse_transactions_task`
   (hàm `@shared_task` ở `tasks.py:50,122,181`) — thực thi network I/O tới DNSE ngay trong HTTP worker,
   treo request, không retry, không job-polling. Chuẩn phải là `.delay()` + polling trạng thái.
2. **[F2-CRIT] Lệnh giao dịch thật không có audit log, không plan-gate, không giới hạn**:
   `dnse_place_order_api` (`views_dnse.py:214-255`) chỉ cần `IsAuthenticated` — user FREE cũng đặt lệnh được;
   `ops_audit` không có event broker/order nào (grep `ops_audit/*.py` 0 hit `dnse|broker|place_order|trading_token`).
   Không có nhật ký ai đặt lệnh gì — rủi ro pháp lý/vận hành cao nhất của tính năng tiền thật.
3. **[F3-HIGH] Mới chỉ có DNSE, TCBS/SSI = 0 dòng tích hợp**: `user_workspace/*.py` grep `tcbs|ssi|provider=` chỉ trúng
   2 dòng vô hại (`portfolio_analytics_views.py:1263`, `vnbroker_dnse_compat.py:43`); i18n `vi.js` 0 key `tcbs/ssi`;
   trong khi vnbroker đã sẵn 3 lane (TCBS iFlash ~50 methods, SSI native ~45 methods + 7 lệnh FCO + WS,
   DNSE ~30 methods). SubAccount đã có trường đa-broker (`broker/broker_source/external_id/sync_status`,
   `models.py:362,375-377`) nhưng chỉ DNSE ghi (`broker_source="DNSE"`, `tasks.py:100`).
4. **[F4-HIGH] Hai hệ credential DNSE song song, dễ lệch**: `identity_access.UserDNSECredential`
   (`models.py:882`, endpoint `dnse-credential/`, `urls.py:68`) vs `user_workspace.DNSECredential`
   (`models.py:393`, endpoint `broker/dnse/config/`, `urls.py:78`). Luồng sync/trade chỉ đọc bản
   `user_workspace` (`views_dnse.py:49,118`); bản `identity_access` (D02-backfill) đứng riêng.
5. **[F5-MED] Order ticket FE nguyên thủy + bẻ convention i18n**: `DNSEConnectionPanel.js:190-225`
   đặt lệnh bằng text-input rời rạc (symbol/price/qty/side/account/trading-token paste tay),
   cứng `market_type="STOCK"`, `order_category="NORMAL"` (`:208-209`), không xem sức mua, không xác nhận,
   không sổ lệnh; toàn file 0 hook i18n (hardcode tiếng Việt, trái convention LangContext);
   adapter DNSE bị xé lẻ giữa `adapters/core/dnse.js` (credential+backfill) và `adapters/core/workspace.js:319,352,363` (trading).

---

## A. Bản đồ kiến trúc (file | trách nhiệm | note)

### A1. vninvest — User-level (đang chạy, DNSE-only)

| File | Dòng | Trách nhiệm | Note |
|---|---|---|---|
| `user_workspace/models.py` | `328-390` | `SubAccount` (tiểu khoản đa-broker) | Đã có `broker_source/external_id/sync_status` — nền đa-broker có sẵn |
| `user_workspace/models.py` | `393-445` | `DNSECredential` (Fernet client_id/secret, OneToOne user) | Lane user thật sự dùng |
| `user_workspace/models.py` | `448-477` | `AccountSnapshot` (NAV/cash/stock/debt theo ngày, unique sub_account+date) | Nền cho P&L/NAV chart |
| `identity_access/models.py` | `882-943` | `UserDNSECredential` + `get_system_provider_credentials()` | Lane thứ 2 (D02 backfill), chỉ admin system-provider |
| `user_workspace/dnse_adapter.py` | `1-95` | Glue: lấy client từ `vnbroker_dnse_compat`, cấm stub giả | Đúng nguyên tắc zero-fake |
| `user_workspace/vnbroker_dnse_compat.py` | `42-151` | `build_dnse_client` + normalize accounts/balance/orders | Gọi `DNSEClient(api_key, api_secret)` (`:43-50`) |
| `user_workspace/views_dnse.py` | `62-338` | 8 endpoints `broker/dnse/*`: config, sync-accounts, sync-balances, reconcile-transactions, send-email-otp, create-trading-token, **place-order**, token-status | Đủ CRUD vòng đời lệnh DNSE |
| `user_workspace/tasks.py` | `34-260` | 2 fan-out + 3 sync tasks (accounts/balances/reconcile), auto-tạo `Portfolio "Danh mục chính"` (`:72-78`) | Upsert `broker_source="DNSE"` (`:100`) |
| `user_workspace/urls.py` | `77-85` | Mount `broker/dnse/*` (8 routes) | Chuẩn REST theo broker |
| `identity_access/dnse_credential_views.py` | `35-93` | CRUD `dnse-credential/` (lane D02) | Trả preview `client_id[:4]+"****"` (`:94-97`) — đúng, không lộ secret |
| `components/DNSEConnectionPanel.js` | `1-513` | Panel PortfoliosPage: credential + sync + OTP + trading-token + **đặt lệnh** (`:190-225`) | Nguyên thủy, hardcode VI |
| `components/DNSECredentialsSection.tsx` | `1-147` | Khối credential trong UserSettingsPage (`:253`) | Có test (`DNSECredentialsSection.component.test.js`) |
| `adapters/core/workspace.js` | `319,352,363` | `syncDNSEAccounts/createDNSETradingToken/placeDNSEOrder` | Lệch khỏi `adapters/core/dnse.js` (chỉ credential+backfill) |
| `pages/PortfoliosPage.tsx` | `103-104` | Nhúng `DNSEConnectionPanel` | Danh mục + broker nối trong 1 trang |
| `i18n/vi.js` | `2006-2021` | `settings.dnse*` (16 keys) | Chỉ DNSE; 0 key TCBS/SSI |

### A2. vninvest — System-level (SOC/vận hành)

| File | Dòng | Trách nhiệm | Note |
|---|---|---|---|
| `service_ops/views/vnbroker.py` | `4-10` | SOC market-data provider ops (config/apply/preview/health/test-connection/providers/benchmark/ownership/circuit-breaker) | **Chỉ market-data, 0 brokerage ops** |
| `service_ops/urls.py` | `48-56` | 9 routes `/api/soc/vnbroker/*` | Không có route broker-accounts/orders/health/credentials |
| `ops_audit/*` | — | Audit log hệ thống | **0 event broker/order** (grep 0 hit) |
| `commercial/*` | `views.py:76-430`, `plan_catalog.py` | VNPay/Stripe billing, plan starter/pro/enterprise | Broker không plan-gate; `UpgradePage.tsx` 0 mention broker |
| `identity_access/views/helpers.py` | `137-150` | Paid plans mở `Transactions/Portfolios/WhaleAdvisory/WhaleAlerts` | Broker-trade không nằm trong abilities — kẽ hở phân quyền |

### A3. vnbroker v3.x — 3 lane sẵn sàng

| Lane | Entry | Quy mô | Auth | Ghi chú cho kế hoạch |
|---|---|---|---|---|
| TCBS iFlash (official) | `broker/tcbs/client.py:40` (~470 dòng, ~50 methods `:60-470`) | profile/accounts/balance/sức mua/cash/margin(+risk/loans)/orders/executions/holdings/đặt-sửa-hủy + stop-limit + phái sinh | `TCBSAuthService.authenticate(otp)` (`broker/tcbs/auth.py:50`), api_key + OTP | Chuẩn production, có `dry_run=True` mặc định ở write (`client.py:333-433`) |
| SSI FastConnect v3 (native, không ssi-sdk) | `broker/ssi/client.py:48` (~760 dòng, ~45 methods `:69-762`) | balance+phái sinh/PPMMR/sức mua/holdings/orders/history/`portfolio_snapshot`/đặt-sửa-hủy(+limit/market)/**7 lệnh FCO** (`:387-650`) + FCO lifecycle/order-book + OHLC/index/master + WS stream (`stream()` `:742`) + `enable_write()` gate (`:758`) | market-only không OTP / OTP / Smart OTP push poll (`auth.py:42-261`) | Lane mạnh nhất; cần 4 env `VNBROKER_BROKER_SSI_*` (`docs/SSI_USAGE_GUIDE.md:1-6`) |
| TCBS Private (advanced) | `brokerage/tcbs/client.py:34` | balance/positions/orders/margin/đặt-sửa-hủy/intraday/derivatives-chain/WS (`:240-454`) | HMAC-SHA256 + OTP challenge (`:97-158`) | Dự phòng khi iFlash thiếu field |
| DNSE LightSpeed | `connector/dnse/client.py:18` (~30 methods `:70-428`) + `trade.py:14` (retail login/deals/PnL/conditional) | accounts/balances/loan/PPSE/orders/đặt-sửa-hủy-thay thế/OTP/trading-token/positions/OHLC/corporate-actions | client_id+secret → Bearer; trade cần email-OTP → trading token | Đang dùng; `put_order/replace_order/close_position` (`:218-303`) **chưa được vninvest khai thác** |
| Substrate an toàn | `broker/security/{audit,credentials,guards,idempotency,redaction}.py` + `UnifiedRegistry.get_broker` (`common/client.py:241-269`) | AuditSink, IdempotencyStore, write_gate, Redactor, register-once thread-safe | — | Tái dùng trực tiếp cho system-level, khỏi phát minh lại |

---

## B. Luồng dữ liệu đã trace (use-case thật, kèm file:line)

**UC-1 Đặt lệnh DNSE (đang chạy)**: `DNSEConnectionPanel.js:190` (nhập tay) → `workspace.js:363 placeDNSEOrder`
→ `POST broker/dnse/place-order/` (`urls.py:84`) → `dnse_place_order_api` (`views_dnse.py:214`)
đòi `trading_token` (`:223-231`) + `payload` dict (`:233-237`) → `_get_active_dnse_client` (`:48-59`)
→ `bootstrap_dnse_session` (`dnse_adapter.py:54`) → `build_dnse_client` (`vnbroker_dnse_compat.py:42`)
→ `DNSEClient.post_order(..., dry_run, raw=False)` (`connector/dnse/client.py:198`).
Nhận xét: đi thẳng BE→broker trong request, không qua hàng đợi, không ghi audit, không check plan.

**UC-2 Đồng bộ danh mục**: Panel `:112-117` → `POST broker/dnse/sync-accounts/` → view gọi **đồng bộ**
`sync_dnse_accounts_task(user.id)` (`views_dnse.py:144`) → `bootstrap_dnse_session` (`tasks.py:59`)
→ `fetch_sub_accounts` (`:67`) → `update_or_create(... broker_source="DNSE")` (`tasks.py:97-113`)
gắn vào `Portfolio "Danh mục chính"` auto-tạo (`:72-78`) → `last_sync_at` (`:116-117`).
Nhận xét: đúng idempotent, nhưng block request (F1); không có Fan-out theo lịch cho user (chỉ có task
fan-out `reconcile_all/sync_all` ở `tasks.py:34-47` nhưng chưa thấy beat schedule trỏ tới — cần verify khi build).

**UC-3 TradingView (tham chiếu)**: Trading Panel → chọn broker tile → Connect (OAuth/credentials)
→ panel hiện positions/orders/history/balances (`implement-broker-api`: `orders/positions/executions/accountManagerInfo`);
Order Ticket (`placeOrder`) + brackets + kéo-thả sửa lệnh trên chart; Paper Trading tách hẳn tiền thật;
multi-broker/account switching trong một hub. **vninvest thiếu toàn bộ lớp này** (không Account Manager,
không Order Ticket chuẩn, không paper, không multi-broker).

---

## C. CONTRADICTIONS (doc/claim vs code)

| # | Claim/doc | Thực tế code | Tác động |
|---|---|---|---|
| C1 | `dnse_adapter.py:9-15` "mọi HTTP/signature DNSE nằm trong vnbroker" | Đúng cho HMAC, nhưng `trade.py` retail-login (`login(user_name,password)`, `connector/dnse/trade.py:52`) tồn tại mà vninvest cấm dùng — ranh giới chỉ giữ bằng convention, không có test khóa | Mở rộng broker mới dễ vô tình dùng nhầm retail-login |
| C2 | Task tên `sync_dnse_*_task` + `@shared_task` ngụ ý chạy nền | View gọi trực tiếp đồng bộ (`views_dnse.py:144,174,204`) | Treo request, mất retry/timeout chuẩn Celery (F1) |
| C3 | `SubAccount` thiết kế đa-broker (`broker_source`, `models.py:376`) | Mọi ghi đều `"DNSE"` (`tasks.py:100,105`); TCBS/SSI = 0 | Mở rộng phải thêm credential model + sync riêng từng broker |
| C4 | SOC có tab `vnbroker` trông như "quản trị broker" | Chỉ là market-data provider ops (`service_ops/views/vnbroker.py:4-10`) | Staff không có công cụ giám sát brokerage (số lệnh, lỗi, credential hết hạn) |
| C5 | Đăng ký nâng scope sau verify (`register.py:296-299`: +`ai:invoke,manage_pats`) | Không có scope/ability nào cho `broker:trade`; `IsAuthenticated` là đủ để đặt lệnh tiền thật | Phân quyền thương mại (FREE vs PRO) không chạm tới brokerage |

---

## D. Findings (ID | Mức | file:line | Thực tế | Tác động | Đề xuất)

- **[F1] ERROR | P0 | `user_workspace/views_dnse.py:144,174,204` + `tasks.py:50,122,181`** | Gọi Celery task đồng bộ trong request (network tới DNSE) | Treo HTTP worker, timeout 504 giờ cao điểm, mất retry | Chuyển `.delay()` + endpoint poll trạng thái job (pattern có sẵn: DataOps Run Logs).
- **[F2] ERROR | P0 | `views_dnse.py:214-255`, `ops_audit/` (0 hit), `helpers.py:137-150`** | Lệnh tiền thật không audit, không plan-gate, không hạn mức | Rủi ro pháp lý + abuse (FREE spam lệnh) | Bắt buộc trước khi mở TCBS/SSI: audit mọi write + gate PRO + hạn mức/ngày (xem Plan G0).
- **[F3] GAP | P0 | `user_workspace/*.py` (grep tcbs/ssi ≈ 0), `i18n/vi.js` (0 key), `upgrade` flow** | Đơn-broker DNSE; 2 broker lớn nhất thị phần (SSI, TCBS) chưa có | Mất user SSI/TCBS — đúng nhóm trả phí | Plan P1 (SSI) → P2 (TCBS) dưới đây.
- **[F4] RISK | P1 | `identity_access/models.py:882` vs `user_workspace/models.py:393`, `identity_access/urls.py:68` vs `user_workspace/urls.py:78`** | 2 credential store DNSE song song | User nhầm lane (lưu bên D02 nhưng trade đọc bên workspace) → "đã lưu mà báo chưa cấu hình" | Gộp thành `BrokerCredential` đa-broker (Plan D1), migrate dữ liệu, giữ alias read-only 1 release.
- **[F5] GAP | P1 | `DNSEConnectionPanel.js:190-225,237-245`** | Order ticket thô + hardcode VI + `STOCK/NORMAL` cứng | Không đạt chuẩn thương mại, EN user không dùng được | Order Ticket chuẩn (Plan U2) + i18n full + buying-power preview.
- **[F6] GAP | P1 | `connector/dnse/client.py:218-303` vs `views_dnse.py`** | `put_order/replace_order/close_position/get_positions` có sẵn nhưng chưa expose | User không sửa/hủy/đóng lệnh DNSE từ app | Bổ sung khi làm U2 (sửa/hủy là yêu cầu tối thiểu của TradingView `modifyOrder/cancelOrder`).
- **[F7] RISK | P1 | `vnbroker_dnse_compat.py:42-50` + `connector/dnse/*` (+245 WS, services mới)** | Glue viết cho DNSEClient cũ; upstream đổi signature | Vỡ sync ngầm sau bump vnbroker | Thêm contract test pin signature (Plan G0).
- **[F8] GAP | P2 | `AccountSnapshot` (`models.py:448`) + tasks fan-out (`tasks.py:34-47`)** | Có model NAV/ngày nhưng chưa thấy beat + chart NAV/P&L cho user | Mất tính năng giữ chân (TradingView: P&L realtime trong Account Manager) | Scheduler + NAV chart (Plan U4/S2).
- **[F9] UX | P2 | `adapters/core/dnse.js` vs `workspace.js:319,352,363`** | Adapter DNSE xé 2 file | Dev mới khó tìm, dễ gọi nhầm endpoint backfill vào trading | Gộp `adapters/core/broker*.js` theo broker (Plan U0).
- **[F10] DOC | P3 | `docs/` (0 doc broker-lane), `DNSE_TAPE_API_GUIDE` chỉ tape** | Không có runbook brokerage (OTP, token TTL, giờ giao dịch, dry-run) | On-call mù khi broker lỗi | Viết `docs/BROKER_RUNBOOK_*` trong Plan G0.

## E. Quality gates audit

- **Type-check**: `npx tsc --noEmit` tại `packages/web` = **exit 0** (chạy 2026-09-23).
- **Lint**: `npx eslint` trên 3 file DNSE (`DNSEConnectionPanel.js`, `adapters/core/dnse.js`, `DNSECredentialsSection.tsx`) = **0 errors**;
  nhưng toàn repo còn nợ warn lớn (theo AGENTS.md ~3549 pre-existing) — không block, track riêng.
- **i18n**: `vi.js:2006-2021` đủ `settings.dnse*`; **vi phạm**: `DNSEConnectionPanel.js` 100% hardcode VI
  (0 hook LangContext), `en.js` thiếu mirror; 0 key TCBS/SSI. `npm run i18n:scan` chưa chạy trong audit này (đề xuất gate trong Plan).
- **Test**: BE có `test_dnse_credential*.py` (model+view+integration) và backfill tests mock compat;
  FE có `DNSECredentialsSection.component.test.js`; **`DNSEConnectionPanel.js` (chứa đặt lệnh) 0 test**;
  `vitest/jest` tổng thể theo AGENTS.md còn nợ pre-existing — Plan yêu cầu test mới cho mọi endpoint broker.
- **External coupling**: vninvest pin `vnbroker@v1.1.0` (`requirements.txt:29`) trong khi SSI lane cần **v3.2.0+**,
  Retail/UI **v3.3.0** — bump là điều kiện tiên quyết P1/P2 (chi tiết ở `docs/NGHIEN_CUU_VNBROKER_NANG_CAP_20260923.md`).

## F. Câu hỏi cần làm rõ (xin phê duyệt)

1. Có cho phép **giao dịch tiền thật** qua app (đặt/sửa/hủy) hay chỉ **đồng bộ xem** (read-only) ở giai đoạn đầu?
2. Broker write có **giới hạn plan PRO** (đề xuất) hay mở cho FREE?
3. Có chấp nhận **lưu secret broker mã hóa trong DB** (Fernet hiện tại) hay yêu cầu vault ngoài (Vault/KMS)?
4. Ưu tiên **SSI trước hay TCBS trước**? (Đề xuất SSI: lane mạnh nhất + FCO là differentiator.)
5. Có cần **Paper Trading** (tiền ảo) như TradingView trước khi mở tiền thật đa-broker không?

## G. Đánh giá tổng thể

Implementable, không blocker kiến trúc: nền đa-broker đã có (`SubAccount.broker_source`, `AccountSnapshot`,
`UnifiedRegistry`, `broker/security/*`), vnbroker đã đủ 3 lane. **Blocker duy nhất là F1+F2 (gọi đồng bộ +
không audit/plan-gate)** — phải fix ở Giai đoạn 0 trước khi thêm broker mới. Thứ tự đề xuất:
**G0 hardening (P0) → SSI read+trade (P1) → TCBS read+trade (P2) → Account Manager + Order Ticket chuẩn +
Paper Trading (P3) → SOC Broker Ops (song song từ G1)**. Chi tiết ở
`docs/IMPLEMENTATION_PLAN_BROKER_MANAGEMENT_20260923.md`.
