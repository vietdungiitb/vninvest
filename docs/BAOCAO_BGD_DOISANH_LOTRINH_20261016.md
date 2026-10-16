# Báo Cáo Ban Giám Đốc: Đối Sánh Thương Mại + Lộ Trình vninvest

> Ngày: 2026-10-16 · Người lập: PM/system designer/tech lead · Trạng thái: DRAFT trình phê duyệt.
> Nguồn: codebase `dev@9912c131b` + staging `docker.edusuccess.vn` + hồ sơ
> `docs/system-design/` (`--check` SẠCH) + benchmark app CK VN 2026 (tra cứu
> 2026-10-16, nguồn ghi từng ô; không tra được ghi CHƯA XÁC MINH).
> Ký hiệu: ✅ đã live/production · 🟡 có code chưa live · ❌ chưa có.

## 1. Tóm tắt điều hành (1 trang)

**vninvest hôm nay là lớp "hub đa-nhà + phân tích" chạy được, không phải app
môi giới.** Điểm mạnh nhất — đồng bộ danh mục đa-broker (DNSE/SSI/TCBS),
Broker Hub, SOC vận hành, chart kỹ thuật — trùng đúng chỗ app VN yếu
(UI rối, sập giờ cao điểm, thiếu paper, AI mới ở mức chatbot). Điểm yếu nhất —
mọi thứ chạm **tiền thật và pháp lý** (eKYC, nạp/rút, margin, phái sinh, lệnh
điều kiện, báo cáo thuế) đều chưa có, và đó là sân nhà của SSI/TCBS/DNSE/VPS.

**Đề nghị chiến lược:** KHÔNG đua làm công ty chứng khoán thứ 8 (cần giấy phép,
ngân hàng, vốn). Thắng ở vị trí **lớp quản trị danh mục + AI đa-nhà** (kiểu
FireAnt/Simplize nhưng có kết nối và đặt lệnh thật qua DNSE): người dùng giữ
tiền ở broker, dùng vninvest để nhìn tổng, đồng bộ, nhận tín hiệu AI, thử
paper. Mọi slice dưới đây phục vụ đúng vị trí đó.

**Xin phê duyệt 4 quyết định:** (Q1) secret rotation trên repo PUBLIC (§5.1);
(Q2) chọn mũi B1 (AI advisory) hay B2 (parity đặt lệnh) làm trước (§6);
(Q3) staff creds staging + ngân sách Gemini/API cho E2E/AI (§6);
(Q4) chốt không làm eKYC/nạp-rút/margin trong 12 tháng (§4.3).

## 2. Ma trận đối sánh (10 nhóm năng lực)

| # | Nhóm | vninvest | SSI iBoard | TCBS | DNSE EntradeX | VPS SmartOne | VNDirect | FireAnt/Simplize |
|---|---|---|---|---|---|---|---|---|
| 1 | Mở TK eKYC + nạp/rút | ❌ | ✅ eKYC 3' | ✅ + iWealth | ✅ NH/QR | ✅ cash advance | ✅ | ❌ (chỉ theo dõi) |
| 2 | Đặt lệnh cơ sở | 🟡 DNSE (paper-gated, chưa E2E live) | ✅ | ✅ + lệnh 24/7 | ✅ | ✅ | ✅ | ❌ |
| 3 | Lệnh điều kiện (STP/trailing) | ❌ | ✅ | ✅ | ✅ | ❓ | ❓ | ❌ |
| 4 | Margin / phái sinh | ❌ | ✅ ~40.473 tỷ dư nợ | ✅ top1 margin | ✅ 5,99%/năm | ✅ >1 tỷ USD | ✅ | ❌ |
| 5 | NAV/danh mục realtime đa-nhà | ✅ đa-nhà (duy nhất) | ✅ 1 nhà | ✅ 1 nhà | ✅ 1 nhà | ✅ 1 nhà | ✅ 1 nhà | 🟡 không tiền thật |
| 6 | Watchlist + cảnh báo | 🟡 manual+derived, cảnh báo giá còn mỏng | ✅ multi-watchlist | ✅ | ✅ Trade Analytics | ✅ | ✅ | ✅ mạnh |
| 7 | Chart kỹ thuật | ✅ widget (Bollinger/MACD/RSI) + DNSE x TradingView ngoài | ✅ MA/RSI/BB | ✅ cơ bản | ✅ | ✅ cơ bản | ✅ D-Rating | ✅ mạnh (ADX/Volume Profile) |
| 8 | AI/khuyến nghị | 🟡 engine có, hết quota, tab Usage rỗng | 🟡 gợi ý | ❓ | ✅ Lệnh AI + Ensa | ❓ | ❓ | ❌ |
| 9 | Paper trading | ❌ (0 kết quả toàn repo) | ❌ | ❌ | 🟡 backtest, không paper live | ❌ | ❌ | ❌ |
| 10 | Phí minh bạch + sao kê thuế | 🟡 invoice Stripe/VNPay (SaaS), chưa sao kê thuế CK | ✅ biểu phí | ✅ Zero Fee | ✅ công khai | ✅ | ✅ 0,10% | ❌ |

Nguồn tra cứu: iboard.ssi.com.vn, apps112.com, help.tcbs.com.vn, tcbs.com.vn,
developers.tcbs.com.vn, entradex.dnse.com.vn, hdsd.dnse.com.vn,
developers.dnse.com.vn, ir.dnse.com.vn, smartone.vps.com.vn, vndirect.com.vn,
help.fireant.vn, simplize.vn, cafef.vn, vneconomy.vn, chinhnhan.vn (08/2026).
Ô ❓ = CHƯA XÁC MINH từ tài liệu công khai.

**Đọc ma trận:** vninvest thắng duy nhất ở ô 5-đa-nhà và ngang ô 7; thua toàn
diện ở 1–4, 10 (sân pháp lý/vốn); ô 8–9 là **khoảng trống chung của thị
trường** — không broker VN nào có paper live tử tế, AI mới ở chatbot/tóm tắt.
Đó là cửa để vượt chứ không chỉ đuổi.

## 3. Việc đã làm tốt (7 hạng mục, có bằng chứng)

1. **Sync engine đa-broker** — position-first idempotent, beat + quiet-hours +
   kill-switch, drift → issue (ledger Entry 317, 61/61 xanh VPS). Không app
   nào trong bảng có hub đa-nhà.
2. **Broker Hub UI** — 3 tile capability-driven, form schema-driven, redirect
   URL cũ (PR #149/#150; `routeCatalog.js:216`, `BrokerHubPage.tsx:14`).
3. **SOC vận hành** — health lane, queue depth, top lỗi, audit CSV, kill-switch
   2 bước (PR #152; `service_ops/views/broker.py:7`). App VN không công bố
   audit-trail tương đương.
4. **Kết nối bảo mật theo lớp** — Fernet + SecretStore versioned, mask preview,
   validation shape, job ownership 404 (PR #164, Entry 328; 13 + 175 tests).
5. **Danh mục + holdings** — CRUD/KPI/pagination, per-row `source` badge,
   scoped/derived watchlist đã mount (PR #151/#153/#154).
6. **Chart kỹ thuật** — widget riêng (`VNStockChartPanel.js:54,161,184`).
7. **Kỷ luật kỹ thuật** — ledger 329 entry, claims registry, gate máy-canh
   (`--check` SẠCH: 43 file, 1483 route, 110 model), TDD fail-before, staging
   verify sau mỗi wave.

## 4. Việc dang dở

### 4.1. P0 — Secret trên repo PUBLIC (§5.1, cần Q1)

`isPrivate: false`; `CORE_PAT_PEPPER` trong 11 commit history; quyết định
"chưa rotate" (2026-10-07) hết hiệu lực vì điều kiện PRIVATE đã mất.

### 4.2. Tính năng CODE nhưng chưa LIVE

- Đặt lệnh DNSE: code + `test_order_safety` nhưng E2E tiền thật chưa chạy;
  SSI/TCBS `trade: False` ngoài phạm vi Wave 1–4.
- AI advisory: engine 15 file/157 methods chạy 170 OK nhưng **hết quota
  Gemini**, tab Usage rỗng, `ai_ready` giả; 46-slice Rev.2 hầu như chưa mở;
  câu hỏi treo: self-service hay staff-only.
- Watchlist 2 chiều broker KHÔNG THỂ (giới hạn API broker); cảnh báo giá mỏng
  hơn FireAnt.

### 4.3. GAP có chủ ý (đề nghị chốt KHÔNG làm 12 tháng — cần Q4)

eKYC, nạp/rút/chuyển tiền, margin cho vay, phái sinh, báo cáo thuế/sao kê
kiểm toán: đòi giấy phép + ngân hàng + vốn đối ứng. Làm = đổi mô hình công ty.

## 5. Tính năng tương lai để ngang bằng (rồi vượt)

Nhóm V (vượt — thị trường bỏ trống): **paper trading live** (widget đã có
`VirtualBrokerEngine` — kiểm chứng lại,claim cũ cần phản chứng), **AI advisory
thật** (quota + R0), **cảnh báo đa điều kiện** (giá + chỉ báo + tin), **nhật ký
lệnh + báo cáo hiệu suất** (thay thế sao kê thuế ở tầng phân tích).
Nhóm P (parity — phải có để giữ user): lệnh điều kiện cơ bản, sổ lệnh realtime
ổn định giờ cao điểm, mobile production, onboarding 3 phút.
Nhóm K (không làm): §4.3.

## 6. Lộ trình 4 pha (đội code cụ thể hóa thành slice + audit)

**Pha A — Khóa an toàn (1–2 tuần, M0).** A1 rotate secret (Q1) · A2 staff creds
+ E2E login/kết nối/đặt paper (Q3) · A3 vệ sinh claims/prose + drill rollback
RTO/RPO. Gate: full BE + E2E xanh, secret-scan 0. *Không mở tính năng mới khi
A1 chưa xong.*

**Pha B — Chọn 1 mũi (4–6 tuần, cần Q2).**
- B1 (AI): quota/budget → R0 (prompt shape, provider/model thật, SSRF, audit
  tenant, `ai_ready` probe) → Usage có số liệu → paper gắn AI (lệnh thử từ tín
  hiệu). Mỗi slice: AC đánh số + contract test + audit độc lập.
- B2 (lệnh): SSI/TCBS read live → lệnh điều kiện cơ bản → sổ lệnh realtime +
  kill-switch mở rộng → paper trading live.
Gate mỗi slice: TDD fail-before + BE VPS + FE suites + tsc/i18n/build +
`--check` SẠCH + audit code độc lập AGREE.

**Pha C — Vượt (6–8 tuần).** Cảnh báo đa điều kiện, nhật ký + báo cáo hiệu
suất, mobile production, onboarding đo được (time-to-first-sync < 5 phút).

**Pha D — Mở rộng (quý tiếp).** Gom 3 store credential → 1 SecretStore, broker
thứ 4+, API công khai cho bên thứ ba, white-label.

*Ước lượng theo đơn vị slice M (3–5 ngày) đã kiểm chứng ở Wave 0–4 (tốc độ
thật ~1 wave/tuần/đội nhỏ). Không cam kết ngày tuyệt đối khi Q1–Q4 chưa chốt.*

## 7. Rủi ro chính

1. Secret PUBLIC nổ trước khi rotate (P0). 2. AI biến thành chatbot trang trí
   nếu không có quota + eval (bài học tab Usage rỗng). 3. Đặt lệnh thật thiếu
   gate = rủi ro tiền + pháp lý (giữ paper-gated). 4. Lệch docs tái diễn sau
   11 ngày nếu thiếu máy-canh (bài học `01.01` §4 — đã trị bằng `--check`).

## 8. Đề nghị phê duyệt

Q1 rotate secret · Q2 chọn B1/B2 · Q3 creds + ngân sách AI/E2E · Q4 chốt nhóm K
không làm 12 tháng. Sau phê duyệt, PM tách slice coding + audit theo mẫu
Wave 0–4 (claim → TDD → gate VPS → audit độc lập → PR → deploy → verify).

## Phụ lục — chỉ mục bằng chứng

- Hồ sơ: `docs/system-design/` (43 file), `TONGKET_HIENTRANG_20261015.md`,
  `HANDOFF_WATCHLIST_HOLDINGS_20261015.md`, `CREDENTIAL_CHECKLIST_BROKER_20261016.md`,
  ledger Entry 317–329, `OPEN_WORK_SEC_20260929.md` (secret), Entry 230 (AI CC Rev.2).
- Hiệu chỉnh trung thực (L-V02): kết luận "13.02/checklist KHÔNG TỒN TẠI" trong
  kiểm kê là SAI — cả hai tồn tại (`13-ROADMAP/13.02-so-no-ky-thuat.md`,
  `CREDENTIAL_CHECKLIST_BROKER_20261016.md` commit `e30868538`).
- CHƯA XÁC MINH: ô ❓ ma trận; số người dùng/doanh thu (ngoài repo); giá API Gemini.
