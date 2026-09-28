# KẾ HOẠCH THỰC THI MASTER — PORTFOLIO COMMERCIAL

**Ngày:** 2026-09-27
**Trạng thái:** APPROVED FOR EXECUTION
**Phạm vi:** Toàn bộ hạng mục portfolio commercial — 9 wave · 61 slice
**Nguồn:**
- `docs/PORTFOLIO_COMMERCIAL_UPGRADE_PROPOSAL_20260927.md` — kiến trúc, ERD, data flow, ROI
- `docs/PORTFOLIO_UI_UX_DESIGN_SPEC_20260927.md` — thiết kế giao diện, component, token, a11y
- `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` — 30 quyết định D-01..D-30
- `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` — 36 finding nguồn

---

## 0. CÁCH DÙNG

### 0.1 Vai trò tài liệu

Đây là **hợp đồng thực thi**. Người nhận việc **không cần hỏi lại** bất kỳ điều gì: mọi quyết định sản phẩm/kỹ thuật đã chốt ở §0.3, mọi tiêu chí nghiệm thu đã định nghĩa ở §0.4, mọi câu hỏi phản biện đã liệt kê sẵn trong từng slice.

**Cấu trúc bộ tài liệu:**

| File | Nội dung | Ai đọc |
|------|----------|---------|
| `PORTFOLIO_EXEC_PLAN_MASTER_20260927.md` (file này) | Protocol · tiêu chuẩn · gate · DAG · tiêu chí phản biện · index 61 slice | Tất cả · Tech Lead · Reviewer |
| `PORTFOLIO_EXEC_SLICES_SEC_SAFE_TENANT_20260927.md` | Wave −1, 0, 1 — 16 slice | Agent nhận slice thuộc 3 wave này |
| `PORTFOLIO_EXEC_SLICES_LEDGER_FE_20260927.md` | Wave 2, 3 — 22 slice | Agent nhận slice ledger/analytics/API/FE |
| `PORTFOLIO_EXEC_SLICES_BROKER_LIVE_OPS_20260927.md` | Wave 4, 5, 6, 7 — 23 slice | Agent nhận slice broker/paper/live/ops |

**Thứ tự đọc bắt buộc:** §0 (master) → tập slice của wave đang làm → `docs/AGENT_PROTOCOL.md` → khai claim → code.

### 0.2 Quy ước định danh

| Mẫu | Ý nghĩa | Ví dụ |
|------|----------|-------|
| `WAVE-SLICE` | Định danh slice, không đổi sau khi khai claim | `SAFE-01` |
| `R<n>` | Yêu cầu (requirement) — phải kiểm chứng được | `R3: kill-switch trả 503 khi DB lỗi` |
| `AC<n>` | Tiêu chí nghiệm thu (acceptance criteria) — có ngưỡng đo | `AC2: 0 cross-tenant response trong 500 request` |
| `PB<n>` | Câu hỏi phản biện bắt buộc — reviewer phải trả lời bằng bằng chứng | `PB1: thử header Tenant B đọc portfolio Tenant A, kết quả?` |
| `EV<n>` | Bằng chứng bàn giao bắt buộc | `EV2: file JSON output của probe 500 request` |
| `GT` | Gate — lệnh phải chạy, kèm expected output | `GT3: npx tsc --noEmit → exit 0, 0 error` |

**Quy tắc:** Mọi `R` và `AC` phải **kiểm chứng được bằng lệnh hoặc đọc file**. Câu nào không kiểm chứng được thì viết lại. Không chấp nhận tiêu chí kiểu "chất lượng tốt", "đúng yêu cầu", "ổn định".

### 0.3 Quyết định đã chốt — đội code KHÔNG hỏi lại

| ID | Quyết định | Ghi chú |
|----|-----------|---------|
| D-01 | R1 chỉ read-only; live order mặc định `paper` | An toàn |
| D-02 | `X-Tenant-ID` (public_id) là nguồn tenant **duy nhất** | Hai resolver gây lệch |
| D-03 | Mọi bảng broker/ledger/job/audit có `tenant_id NOT NULL` + index | Chặn cross-tenant |
| D-04 | Portfolio thuộc `(tenant, user)`; R1 không có shared household | Đơn giản |
| D-05 | Base currency VND; FX/multi-currency defer | Broker VN |
| D-06 | **Cost = weighted average**; cổ tức là cash flow **không** giảm cost; phí/thuế BUY vốn vào cost; phí/thuế SELL trừ khỏi realized P&L và cash | Khớp widget `costBasisMethod: "average"` |
| D-07 | Corporate actions R1: stock split + bonus; rights/IPO defer | — |
| D-08 | Broker-synced transaction append-only; sửa = reversal entry; manual entry editable | Auditability |
| D-09 | API mới chỉ dưới `/core/v1/workspace/*`; `/api/*` legacy freeze | — |
| D-10 | Endpoint mới trả `{data, meta}`; endpoint cũ giữ shape 1 release; FE có normalizer dual-read | Không breaking |
| D-11 | Lỗi API dùng RFC 9457 `application/problem+json` | Chuẩn quốc tế |
| D-12 | `Idempotency-Key` bắt buộc mọi write tài chính; unique `(tenant_id, actor_id, scope, key)`; TTL 7 ngày | Chống double order |
| D-13 | Queue mới `broker` + worker riêng; test chạy `task_always_eager=False` + Redis thật | Không được fake |
| D-14 | Kill-switch **fail-closed**: lỗi DB = deny write | — |
| D-15 | Broker secret dùng `BROKER_SECRET_KEY` riêng, **không** derive từ `SECRET_KEY`; có `secret_version` | — |
| D-16 | Capability matrix là **dữ liệu versioned**, không phải hằng | — |
| D-17 | Retention: ledger/order/audit ≥ 7 năm; cache/snapshot 90 ngày; job log 30 ngày | — |
| D-18 | SLO: read API p95 ≤ 500ms (warm); sync freshness p95 ≤ 30 phút trong giờ giao dịch; order duplicate = 0; audit completeness = 100%; isolation violations = 0 | Đo được |
| D-19 | Test gate deterministic: `npm run test:components` chạy **3 lần liên tiếp** cùng commit, cả 3 xanh mới ký release | Chống rerun xanh giả |
| D-20 | Chuẩn bắt buộc: OWASP ASVS 5.0 L2 (R1/R2) → L3 (R3); OWASP API Top 10 2023; RFC 9457; OpenAPI 3.1; WCAG 2.2 AA; CycloneDX SBOM ≥1.6; ISO/IEC 25010:2023 + 25012:2008; ISO/IEC 27001:2022 | §0.4 |
| D-21 | `vnbroker` là **sở hữu của chủ repo** ⇒ **KHÔNG còn là blocker pháp lý**. R3 live trading được phép triển khai | Đã chốt 2026-09-27 |
| D-22 | Monetization: FREE = manual/CSV + paper; PRO = broker read-only; ENTERPRISE = +API/PAT; **live trade = approval riêng** | — |
| D-23 | Kill-switch và audit write bắt buộc ở **4 lớp**: middleware, view, service, worker | Không bỏ sót |
| D-24 | Migration chỉ theo expand → backfill → verify → cutover → contract. Reverse chỉ revert row do chính migration đó backfill | — |
| D-25 | Không dùng real-money E2E; chỉ paper/sandbox/mocked broker trong CI; live chỉ canary thủ công có approval | — |
| D-26 | Dùng `defaultCoreApiAdapter as unknown as { ... }` cho method mới | Convention repo |
| D-27 | Benchmark: **VN30 chính, VN100 phụ**. Performance: **TWR là mặc định**; MWR chỉ khi ≥2 external cash flow; method ghi trong `meta.calculation_version` | — |
| D-28 | Freshness SLA: DNSE ≤ 15 phút; SSI/TCBS ≤ 30 phút; ngoài phiên ≤ 24h; quá ngưỡng ⇒ `stale=true` + alert | — |
| D-29 | Rotate secret = **một sự kiện**: 7 key đổi cùng lúc; chấp nhận session/PAT cũ vô hiệu, phải thông báo user trước | — |
| D-30 | Drop store DNSE legacy chỉ khi route trả **410 + header `Deprecation`** + metric `legacy_credential_usage` = 0 trong **30 ngày liên tục** + sau 2 release | — |
| **D-31** *(mới)* | **Chart engine**: `vninvestcharts-widget` cho **mọi** chart trục thời gian. ECharts **chỉ** cho allocation treemap/sunburst | Đã chốt 2026-09-27 |
| **D-32** *(mới)* | **Widget version**: nâng `^1.2.5` → `^1.4.0` | Đã chốt 2026-09-27 |
| **D-33** *(mới)* | **Paper trading**: dùng `VirtualBrokerEngine` của widget, phương án **PA-1** (sandbox độc lập, KHÔNG ghi ledger server). Không viết `OrderTicketForm` mới | Đã chốt 2026-09-27 |
| **D-34** *(mới)* | `PaperRuntimeConfig.pnlDisplayMode` phải set **`"net"`** (mặc định widget là `"gross"`, lệch D-06) | Bắt buộc |
| **D-35** *(mới)* | Phải chặn `isUnclassifiedMarketSymbol()` trước khi cho crypto vào paper engine (crypto rơi vào `VN_SPOT` ⇒ lot 100 + T+2 sai) | Bắt buộc |
| **D-36** *(mới)* | **5 trang workspace**: Overview · Holdings · Activity · Analytics · Allocation. Broker Hub tách riêng | Đã chốt 2026-09-27 |

### 0.4 Bộ tiêu chuẩn quốc tế — mapping với slice

| Chuẩn | Phiên bản | Mục tiêu | Slice đạt | Gate kiểm chứng |
|--------|-----------|----------|-----------|-----------------|
| **OWASP ASVS** | 5.0.0 | R1/R2 → L2 · R3 → L3 | Tất cả wave 0–7 | `docs/evidence/<slice>/asvs-checklist.md` — mọi mục L2 pass |
| **OWASP API Security Top 10** | 2023 | API1–API10 | API-01/02, SAFE-*, TEN-* | `api-security-matrix.md` — 10/10 dòng có biện pháp + test |
| **RFC 9457** | 2023-07 | `application/problem+json` | API-01 | Test assert header + body shape |
| **OpenAPI** | 3.1 | Contract-first | API-02 | `openapi.json` valid, không warning |
| **WCAG** | 2.2 AA (W3C Rec 2024-12-12) | A11y | FE-*, cross-cutting | `axe` scan 0 critical + kiểm tra thủ công 5 tiêu chí |
| **ISO/IEC 25010** | **2023** | 9 đặc tính chất lượng | OPS-01 | `quality-budget.md` — đo từng đặng tính |
| **ISO/IEC 25012** | 2008 | 6 đặc tính chất lượng dữ liệu | LED-*, ANA-* | `data-quality.md` — accuracy/completeness/consistency/timeliness/validity/traceability |
| **ISO/IEC 27001** | 2022 | ISMS | OPS-07 | `isms-evidence.md` |
| **CycloneDX** | ≥ 1.6 | SBOM | OPS-06 | `sbom.json` valid theo schema |
| **Google SRE Workbook** | — | SLO, error budget | OPS-01 | SLO đo được + burn rate alert |
| **DORA** | — | Change fail rate, MTTR | OPS-01 | 4 metric theo dõi |

> **Lưu ý về ISO/IEC 25010:** bản 2011 đã **withdrawn** (03/2024). Dùng bản **2023**. Đây là điểm nhiều tài liệu cũ sai.

### 0.5 Ma trận gate bắt buộc

Không slice nào merge được nếu thiếu **một** dòng trong bảng này.

| # | Gate | Lệnh | Expected | Bắt buộc ở wave |
|---|------|------|----------|-----------------|
| GT1 | Type check | `npx tsc --noEmit` (web) | exit 0, 0 error | Tất cả FE slice |
| GT2 | Build | `npm run build` | exit 0 | Tất cả FE slice |
| GT3 | Lint | `npm run lint` | 0 error (warning chấp nhận) | Tất cả FE slice |
| GT4 | FE test | `npm run test:components` | 3 lần liên tiếp đều PASS (D-19) | Tất cả FE slice |
| GT5 | FE i18n | `npm run i18n:scan` + `npm run hardcode:scan` | 0 missing, 0 hardcode | FE-*, cross-cutting |
| GT6 | Django check | `python src/manage.py check` | 0 issue | Tất cả BE slice |
| GT7 | Migration drift | `python src/manage.py makemigrations --check --dry-run` | "No changes detected" | Slice đụng model |
| GT8 | Migration apply | `python src/manage.py migrate` trên **Postgres** | exit 0 | Slice có migration |
| GT9 | BE test | `python src/manage.py test <app>` | 0 failure, 0 error | Tất cả BE slice |
| GT10 | Secret scan | `git grep -InE 'github_pat_|ghp_|DNSE_CREDENTIAL_FERNET_KEY=[A-Za-z0-9]' -- . ':!*.example'` | 0 hit | Tất cả slice |
| GT11 | Multi-agent gate | `node packages/web/scripts/check-multi-agent.mjs` | exit 0 | Khi ≥2 agent |
| GT12 | A11y | `axe` scan trên 5 trang portfolio | 0 critical, 0 serious | FE-02..FE-06 |
| GT13 | A11y thủ công | checklist WCAG 2.2 AA §0.4 | 5/5 tiêu chí pass | FE-02..FE-06 |
| GT14 | BE test env | `CORE_DATABASE_URL` trỏ **Postgres** + `DJANGO_DEBUG=1` | Không dùng SQLite | Tất cả BE slice |
| GT15 | Evidence pack | `docs/evidence/<slice>/` đủ EV1..EVn | Không thiếu | Mọi slice |

**Bẫy đã gặp thật và cách tránh:**

| Bẫy | Hậu quả | Cách tránh |
|------|---------|-----------|
| BE test chạy trên SQLite | `array_agg` của Postgres ⇒ `OperationalError` lúc migrate | GT14 — dựng Postgres riêng |
| Gọi gate qua pipe (`node check.mjs \| sed`) | Exit code lấy của lệnh cuối ⇒ **gate không bao giờ fail** | Capture exit code, không pipe |
| Tin số migration đọc trong worktree | Worktree không thấy việc chưa commit của agent khác | Đọc head trên branch tích hợp, ngay trước khi tạo file |
| Chạy gate **trước** khi rebase | Báo xanh nhưng code sau rebase khác | `agent-sync.ps1` rồi mới chạy gate |
| `print()` tiếng Việt có dấu trong migration | `UnicodeEncodeError` cp1252 ⇒ `migrate` fail giữa chừng | Không `print()` trong migration; dùng `logger` |
| Báo "PASS" cho gate chưa chạy | Đắt nhất | `CHƯA CHẠY` là kết quả hợp lệ |

### 0.6 Quy trình thực thi (mỗi slice)

```
┌─ 1. Mở phiên ────────────────────────────────────────────┐
│ sh scripts/agent-install-hooks.sh                         │
│ pwsh -File scripts/agent-sync.ps1                        │
│ git -C <main tree> status --short                        │
│ Nếu thấy file lạ chưa ai claim → DỪNG, báo coordinator   │
└──────────────────────────────────────────────────────────┘
                        ↓
┌─ 2. Đọc slice ───────────────────────────────────────────┐
│ Đọc 12 mục của slice trong tập slice tương ứng            │
│ Đọc docs/AGENT_PROTOCOL.md                                │
└──────────────────────────────────────────────────────────┘
                        ↓
┌─ 3. Khai claim (TRƯỚC khi sửa dòng đầu tiên) ────────────┐
│ Append 1 dòng vào cuối docs/CLAIMS.md, commit riêng        │
│ Không commit 11 file shared (xem §0.8)                     │
└──────────────────────────────────────────────────────────┘
                        ↓
┌─ 4. Code ─────────────────────────────────────────────────┐
│ Chỉ sửa file trong allowlist của slice                    │
│ Migration: để makemigrations sinh số, KHÔNG tự đặt        │
│ Test trước hoặc song song với code                        │
└──────────────────────────────────────────────────────────┘
                        ↓
┌─ 5. Tự kiểm chứng ───────────────────────────────────────┐
│ Chạy GT1..GTn của slice                                   │
│ Tự trả lời PB1..PBn của slice (nếu không tự trả lời được│
│   ⇒ slice chưa xong)                                     │
│ Gom evidence vào docs/evidence/<slice>/                   │
└──────────────────────────────────────────────────────────┘
                        ↓
┌─ 6. Đóng phiên ───────────────────────────────────────────┐
│ pwsh -File scripts/agent-sync.ps1 (rebase → migration →   │
│   gate) — SAU khi rebase thì chạy lại GT                  │
│ Claim → done → push                                       │
│ pwsh -File scripts/agent-pr.ps1                           │
│ PR body: bảng gate ĐỂ TRỐNG cho reviewer, KHÔNG pre-fill  │
└──────────────────────────────────────────────────────────┘
                        ↓
┌─ 7. Reviewer độc lập ─────────────────────────────────────┐
│ Agent khác, `edit: deny`                                  │
│ Trả lời PB1..PBn bằng bằng chứng do MÌNH chạy            │
│ Không tin báo cáo của implementer                         │
└──────────────────────────────────────────────────────────┘
```

**Gate 6→7:** mọi dòng gate đọc `Pass`, **hoặc** `CHƯA CHẠY` kèm lý do và được reviewer chấp nhận bằng văn bản. `Fail` ⇒ quay lại bước 4.

**Gate 7→merge:** `docs/evidence/<slice>/audit.md` báo `0 lỗi còn lại` + `confidence: high`.

### 0.7 Mẫu bằng chứng (evidence pack)

Mỗi slice tạo `docs/evidence/<slice-slug>/`:

```
docs/evidence/<slice-slug>/
├── gates.md              # GT1..GTn: lệnh + output thật + timestamp
├── tests.md              # Tên test file, số case, output, lần chạy
├── pb-answers.md         # Trả lời PB1..PBn kèm bằng chứng
├── asvs-checklist.md     # Nếu slice thuộc ASVS scope
├── rollback.md           # Cách revert + đã test revert chưa
└── commands.md           # Mọi lệnh đã chạy, copy-paste được
```

**Quy tắc bằng chứng:**
- Output thật, không diễn giải. Dán nguyên văn terminal output.
- Kèm **command sinh ra output đó** — số không có lệnh tái tạo thì không phải bằng chứng.
- Ảnh chụp màn hình kèm timestamp + URL.
- Nếu gate **không chạy được**: ghi `CHƯA CHẠY` + lý do cụ thể. **Không** ghi `Pass`, **không** dùng `skip` để ngụ ý đã xong.

### 0.8 File shared — KHÔNG được commit khi ≥2 agent

| File | Lý do |
|------|-------|
| `AGENTS.md` | Append-only, 1 hunk gộp nhiều agent, tách không được |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Append-only, cùng lý do |
| `packages/web/package.json` | Dời dep của mọi người |
| `pyproject.toml` · `requirements.txt` | Dời dep |
| `package-lock.json` | Sinh tự động, gây conflict |
| `docker-compose*.yml` | ảnh hưởng mọi service |
| `.env*` | chứa secret |

→ Ghi nhu cầu vào `note` của claim + báo coordinator. **Hook sẽ chặn.** Ngoại lệ duy nhất là commit hợp nhất của coordinator.

### 0.9 Tiêu chí phản biện — cách reviewer kiểm tra

**Nguyên tắc:** reviewer **không** tin báo cáo của implementer. Mỗi `AC` phải bị **cố gắng phủ nhận**. Nếu không phủ nhận được mới coi là đạt.

**5 câu hỏi bắt buộc cho mọi slice:**

1. **Số này tái tạo được không?** Nếu không có lệnh sinh ra nó → số đó là ƯỚC LƯỢNG, ghi rõ hoặc xoá.
2. **Dòng code trích dẫn có đúng byte không?** Mở file, đọc dòng đó. Đọc file UTF-8 bằng công cụ giả định cp1252 sẽ tạo ra finding "mojibake" giả — citation vẫn đúng nên qua mọi kiểm tra dòng.
3. **Phạm vi đo có khớp phạm vi tuyên bố không?** Đếm lại với đúng scope. Số ở scope khác là finding.
4. **Có đường gọi nào bỏ qua thay đổi không?** Grep toàn bộ repo, không chỉ file đã sửa — kể cả `.css`, config, test, script.
5. **Điều gì hỏng nếu slice này chỉ làm 90%?** Nếu câu trả lời là "không sao" ⇒ AC chưa đủ cụ thể.

**Cấm trong báo cáo:**
- Số không kèm lệnh tái tạo
- "Đã kiểm tra" mà không dán output
- "PASS" cho gate chưa chạy
- Kết luận về hành vi runtime khi chỉ đọc code
- Claim "an toàn" khi đã bỏ sót đường gọi thứ hai

**Kết quả bắt buộc của reviewer:** `docs/evidence/<slice-slug>/audit.md` với đếm số lỗi còn lại + `confidence: high|medium|low`. `confidence` thấp nghĩa là chưa verify được — là thông tin, không phải nghi thức.

### 0.10 Bản đồ 9 wave

| Wave | Tên | Slice | ed | Exit criteria (tất cả phải đạt) |
|------|-----|-------|----|--------------------------------|
| **−1** | Security | SEC-01..03 | 4–6 | GT10 = 0 hit trên HEAD; 7 key đã rotate; `git log` không còn secret reachable |
| **0** | Safety | SAFE-01..07 | 24–30 | Order không thể fail-open; kill-switch fail-closed 4 lớp; CI fail-closed; audit completeness 100% trên test |
| **1** | Tenant | TEN-01..06 | 21–28 | 0 cross-tenant response trong 500 request đối chiếu; migration `0008` chạy được trên DB có dữ liệu |
| **2** | Ledger + Analytics | LED-01..07, ANA-01..05 | 30–38 | NAV khớp tay trên 3 case mẫu; TWR/MWR đối chiếu tài liệu; 0 số 0 giả |
| **3** | API + FE | API-01..02, FE-01..08 | 33–42 | 5 trang workspace chạy; axe 0 critical; i18n parity 100%; equity curve vẽ đúng (không phải 0) |
| **4** | Broker | BRK-01..06 | 24–31 | Sync bất đồng bộ qua queue thật; reconciliation có bảng diff; SSRF test pass |
| **5** | Paper | PAP-01..05 | 16–22 | Paper order chạy; `pnlDisplayMode=net`; crypto bị chặn; widget 1.4.x đã cài |
| **6** | Live | LIV-01..05 | 21–28 | RiskLimit chặn đúng; canary 1 user → 100%; DR drill thật |
| **7** | Hardening | OPS-01..07 | 19–26 | ASVS L2 100%; SLO đo được; SBOM valid; load test p95 ≤ 500ms |

**Ước lượng tổng: 192–251 engineer-days · 5–6 tháng với 4 agent song song.**

### 0.11 DAG phụ thuộc

```
W-1 SEC ──────────────────────────────► (không phụ thuộc gì)
  │
  ▼
W0  SAFE-01..07 ───────────────────────► (cần SEC xong)
  │
  ▼
W1  TEN-01..06 ────────────────────────► (cần SAFE xong)
  │
  ├──► W2  LED-01..07 ──► ANA-01..05 ──► (cần TEN xong)
  │                     │
  │                     ▼
  │              W3  API-01/02 ──► FE-01..08 ──► (cần W2 xong)
  │                                        │
  │                                        ▼
  │              W5  PAP-01..05 ◄──────────┘  (cần FE-01 + widget 1.4.x)
  │                                        │
  ▼                                        ▼
W4  BRK-01..06 ──────────────────────► W6  LIV-01..05 ──► W7  OPS-01..07
  (cần W1)                                 (cần W4 + W5)
```

**Cạm bẫy DAG:** `PAP-01` (paper engine) phụ thuộc `FE-01` (workspace shell) **và** widget 1.4.x. Nếu chạy song song, sẽ có 2 người sửa `packages/web/package.json` — file shared. Phải giao cho **một** agent.

**Cạm bẫy khác:** `TEN-05` (sửa migration `0008`) và bất kỳ slice nào tạo migration mới đều chạm `user_workspace/migrations/`. Nếu chạy song song sẽ trùng số. Serialize: `TEN-05` xong trước khi mở `LED-05`.

### 0.12 Index 61 slice

| Wave | Slice | Tên | ed | Tập tài liệu |
|------|-------|-----|----|---------------|
| −1 | SEC-01 | Revoke & rotate 7 secret | 2 | SEC_SAFE_TENANT |
| −1 | SEC-02 | SecretStore abstraction + `BROKER_SECRET_KEY` | 2 | SEC_SAFE_TENANT |
| −1 | SEC-03 | Gỡ secret khỏi tracked files + CI scan | 2 | SEC_SAFE_TENANT |
| 0 | SAFE-01 | Order fail-closed + server-side mode | 4 | SEC_SAFE_TENANT |
| 0 | SAFE-02 | `Idempotency-Key` bắt buộc | 3 | SEC_SAFE_TENANT |
| 0 | SAFE-03 | Kill-switch fail-closed 4 lớp | 4 | SEC_SAFE_TENANT |
| 0 | SAFE-04 | RBAC/capability toàn endpoint | 3 | SEC_SAFE_TENANT |
| 0 | SAFE-05 | Domain audit event + outbox | 4 | SEC_SAFE_TENANT |
| 0 | SAFE-06 | Queue `broker` + worker thật | 4 | SEC_SAFE_TENANT |
| 0 | SAFE-07 | CI gate fail-closed | 2 | SEC_SAFE_TENANT |
| 1 | TEN-01 | Một tenant resolver duy nhất | 4 | SEC_SAFE_TENANT |
| 1 | TEN-02 | FE tenant SSOT (`tenantIdStorage`) | 3 | SEC_SAFE_TENANT |
| 1 | TEN-03 | `BrokerConnection` có `tenant_id` | 4 | SEC_SAFE_TENANT |
| 1 | TEN-04 | Đóng leak analytics cross-tenant | 4 | SEC_SAFE_TENANT |
| 1 | TEN-05 | Sửa migration `0008` | 3 | SEC_SAFE_TENANT |
| 1 | TEN-06 | Cache key có `tenant_id` | 3 | SEC_SAFE_TENANT |
| 2 | LED-01 | Model `LedgerEntry` + `CashFlow` | 4 | LEDGER_FE |
| 2 | LED-02 | Model `PositionSnapshot` | 3 | LEDGER_FE |
| 2 | LED-03 | Model `ValuationSnapshot` + NAV engine | 4 | LEDGER_FE |
| 2 | LED-04 | Validator tài chính | 3 | LEDGER_FE |
| 2 | LED-05 | Migration `Transaction` → `LedgerEntry` | 4 | LEDGER_FE |
| 2 | LED-06 | Model `IdempotencyRecord` | 2 | LEDGER_FE |
| 2 | LED-07 | Ledger cache + provenance `meta` | 3 | LEDGER_FE |
| 2 | ANA-01 | TWR / MWR | 3 | LEDGER_FE |
| 2 | ANA-02 | Benchmark VN30/VN100 + alpha/beta | 3 | LEDGER_FE |
| 2 | ANA-03 | Risk: volatility, VaR 95%, max drawdown, concentration | 4 | LEDGER_FE |
| 2 | ANA-04 | Allocation theo ngành | 2 | LEDGER_FE |
| 2 | ANA-05 | Freshness SLA + cờ `stale` | 2 | LEDGER_FE |
| 3 | API-01 | RFC 9457 `problem+json` | 3 | LEDGER_FE |
| 3 | API-02 | OpenAPI 3.1 + envelope `{data, meta}` | 3 | LEDGER_FE |
| 3 | FE-01 | Workspace shell + tab routing | 3 | LEDGER_FE |
| 3 | FE-02 | Trang Overview (KPI + equity curve widget) | 4 | LEDGER_FE |
| 3 | FE-03 | Trang Holdings (bảng 13 cột) | 4 | LEDGER_FE |
| 3 | FE-04 | Trang Activity (timeline + CSV) | 3 | LEDGER_FE |
| 3 | FE-05 | Trang Analytics (performance/risk/drawdown) | 4 | LEDGER_FE |
| 3 | FE-06 | Trang Allocation (ECharts treemap) | 3 | LEDGER_FE |
| 3 | FE-07 | Design token portfolio + dark/light | 3 | LEDGER_FE |
| 3 | FE-08 | i18n VI/EN parity 100% | 3 | LEDGER_FE |
| 4 | BRK-01 | Credential cutover + deprecation 410 | 4 | BROKER_LIVE_OPS |
| 4 | BRK-02 | `secret_version` + rotate an toàn | 3 | BROKER_LIVE_OPS |
| 4 | BRK-03 | Capability matrix versioned | 3 | BROKER_LIVE_OPS |
| 4 | BRK-04 | Sync bất đồng bộ + reconciliation | 5 | BROKER_LIVE_OPS |
| 4 | BRK-05 | Chống SSRF `test-connection` | 3 | BROKER_LIVE_OPS |
| 4 | BRK-06 | SOC panel Broker Ops | 3 | BROKER_LIVE_OPS |
| 5 | PAP-01 | Tích hợp `VirtualBrokerEngine` + `pnlDisplayMode=net` | 4 | BROKER_LIVE_OPS |
| 5 | PAP-02 | Mount `TradingDockPanel` vào Broker Hub | 3 | BROKER_LIVE_OPS |
| 5 | PAP-03 | Chặn market chưa phân loại (crypto) | 2 | BROKER_LIVE_OPS |
| 5 | PAP-04 | Plan gating + paper không gọi broker thật | 3 | BROKER_LIVE_OPS |
| 5 | PAP-05 | Nâng widget `1.2.5` → `1.4.0` | 4 | BROKER_LIVE_OPS |
| 6 | LIV-01 | Live gates (kill-switch + capability + approval) | 4 | BROKER_LIVE_OPS |
| 6 | LIV-02 | Order modify/cancel + `OrderEvent` | 4 | BROKER_LIVE_OPS |
| 6 | LIV-03 | `RiskLimit` + enforcement | 5 | BROKER_LIVE_OPS |
| 6 | LIV-04 | Canary release 1% → 100% | 4 | BROKER_LIVE_OPS |
| 6 | LIV-05 | DR drill | 4 | BROKER_LIVE_OPS |
| 7 | OPS-01 | SLO + error budget + alert | 4 | BROKER_LIVE_OPS |
| 7 | OPS-02 | Load test 1000 user đồng thời | 3 | BROKER_LIVE_OPS |
| 7 | OPS-03 | Backup/restore + PITR | 3 | BROKER_LIVE_OPS |
| 7 | OPS-04 | ASVS 5.0 L2 + pen test | 5 | BROKER_LIVE_OPS |
| 7 | OPS-05 | Retention policy 7 năm | 2 | BROKER_LIVE_OPS |
| 7 | OPS-06 | SBOM CycloneDX ≥1.6 | 2 | BROKER_LIVE_OPS |
| 7 | OPS-07 | ISO 27001 evidence pack | 3 | BROKER_LIVE_OPS |

**Tổng: 61 slice · 192–251 ed.**

### 0.13 Việc owner phải làm (không ai trong đội code làm được)

| # | Việc | Chặn wave | Ghi chú |
|---|------|-----------|---------|
| 1 | **Revoke + rotate 7 secret** ngay hôm nay | −1 | `CORE_DJANGO_SECRET_KEY`, `CORE_PAT_PEPPER`, `CORE_AD_SIGNING_SECRET`, `DNSE_CREDENTIAL_FERNET_KEY`, `DNSE_API_KEY`, `DNSE_API_SECRET`, `GITHUB_CLIENT_SECRET`. Đổi **cùng lúc** (D-29) |
| 2 | Thông báo user trước khi rotate (session/PAT cũ sẽ vô hiệu) | −1 | D-29 |
| 3 | Cấp license `vni1.*` cho domain sản phẩm | 3, 5 | Widget tier Pro/Enterprise |
| 4 | Xác nhận `api_calls_limit` + quota theo plan | 0 | Ảnh hưởng `models.py:107` |
| 5 | Ký `vnbroker` license nếu còn điều khoản giới hạn | 6 | **Đã chốt D-21: của chủ repo, không chặn** |

> **Không có môi trường ⇒ không có kết luận.** Nếu gate không chạy được vì thiếu Postgres/env, ghi `CHƯA CHẠY` + lý do. Đừng suy ra "chắc là được".

---

*Tiếp theo: đọc tập slice tương ứng wave bạn được giao.*
