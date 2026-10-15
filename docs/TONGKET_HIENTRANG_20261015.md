# Tổng Kết Hiện Trạng Dự Án vninvest (2026-10-15)

> Đồng bộ 3 nguồn: codebase (`dev@99b0bedf0`) · staging (`https://docker.edusuccess.vn`)
> · hồ sơ system-design (`--check` SẠCH, exit 0 ngày 2026-10-15).
> Ký hiệu tin cậy theo `docs/system-design/README.md` §1.4:
> ✅ XÁC MINH (lệnh thật + `file:line`) · ⚠ SUY LUẬN · ❓ CHƯA XÁC MINH.
> Mọi con số máy đo được đều có lệnh tái tạo; số kế thừa ghi rõ nguồn.

## 1. Đã làm (✅, 2026-10-14 → 2026-10-15, 128 commit)

| Việc | Bằng chứng | Gate chạy thật |
|---|---|---|
| Wave 0 multi-broker B0.1–B0.6 (SubAccount/kind/binding/trigger/sync-async/capabilities) | PR merge vào `dev`, migration head `0030` (`packages/core/backend/src/user_workspace/migrations/`) | BE VPS theo runbook §12, `makemigrations --check` sạch |
| Wave 1 sync engine đa provider | PR #147 (claim `mbw1-wave`, ledger Entry 317) | 61/61 xanh trên VPS |
| Wave 2 Broker Hub UI (`/broker`, 3 tile, Account Manager, SyncCenter) | `BrokerHubPage.tsx:14-24`, `routeCatalog.js:211-248`, PR #149 | FE suites + build xanh |
| Wave 3 cô lập & gộp danh mục (bindings GET, guard aggregate, backfill 0030, watchlist scoped) | PR #151 (`2ba62c781`), Entry 321 | BE 101/101 + FE 37/37 VPS |
| Wave 4 SOC Broker Ops (health lane, expiry derived, kill-switch, audit CSV) | PR #152 (`e2e4493ac`), Entry 322 | BE 28/28 + FE 7/7 + pre-push 22/22 |
| Triệt để watchlist/holdings (mount `ScopedWatchlist`, per-row `source`, FERNET + migrate staging 0023→0030) | PR #154 (BE) + #153 (FE) + #155 (closeout), Entry 323 | BE VPS 40 OK + FE 18/18 + tsc 0 + i18n:strict 0 + build 38s |
| Staging đồng bộ `dev@99b0bedf0` | `deploy-staging.sh --verify` xanh, public `/broker` 200, bundle có `BrokerHubPage-*` + `ScopedWatchlist-*` | kiểm trực tiếp trên VPS 2026-10-15 |

## 2. Còn dang dở

### 2.1. P0 — Secret trên repo PUBLIC (cần Owner, ✅ xác minh repo mở)

- `gh repo view --json isPrivate` → `false` (PUBLIC).
- `CORE_PAT_PEPPER` sống trong 11 commit history; `BROKER_SECRET_KEY` chưa rotate
  (`docs/OPEN_WORK_SEC_20260929.md:23-24`).
- Quyết định "không rotate lúc này" (2026-10-07) đặt điều kiện repo PRIVATE —
  điều kiện đã mất hiệu lực. Thứ tự đúng: revoke → rotate → gỡ khỏi HEAD →
  purge (L-S01). Agent KHÔNG tự làm.

### 2.2. Mảng lớn chưa mở

- **AI Command Center Rev.2** (Entry 230): 46 slice, 5 blocker production
  (`openclaw` default → `raise` khi `DEBUG=False`, prompt shape mất cấu hình âm
  thầm, SSRF, audit cross-tenant, `ai_ready` giả). BE test CHƯA XÁC MINH.
  Quyết định treo: self-service hay staff-only (Entry 228).
- **Live trading R3**: license Owner đã chốt OK (2026-10-07) nhưng thiếu toàn bộ
  gate an toàn (paper qua `VirtualBrokerEngine`, risk limit, approval).
  Kill-switch B4.2 tái dùng được.

### 2.3. Kiểm chứng còn thiếu (ghi CHƯA CHẠY, không suy ra)

E2E đăng nhập/kết nối broker thật, staff-creds drill, đối chiếu UI bằng mắt,
full BE suite (~2960 baseline), ruff. Nguyên nhân chung: không staff creds
staging, không browser E2E.

### 2.4. Nợ vệ sinh (ghi N-003/N-004 vào `13.02` kèm lệnh tái tạo)

- Văn xuôi lệch khỏi máy đo: plan multi-broker §4 mới ghi Wave 0 xong (thiếu
  Wave 1–4 + triệt để); `01.01`/`README` ghi 1473 route trong khi máy đo 1483.
- 6 claim `in-progress` không còn branch (local + remote đều rỗng) — xác chết
  trong registry (hiện 79 warning ở gate).

## 3. Hướng phát triển tiếp (thứ tự đề xuất)

- **Pha A — khóa an toàn (1–2 tuần):** rotate secret (F1) → staff creds + E2E →
  xóa claim chết + sửa prose lệch → drill rollback chốt RTO/RPO (`09.02` §6).
  Không mở tính năng mới khi P0 còn mở (`13.01` §3).
- **Pha B — chọn 1 mũi:** AI CC R0 (M0 bắt buộc theo plan) **hoặc** paper→live
  có gate (risk limit, approval).
- **Pha C — cứng hóa:** bundle budget riêng operations-center (~2.3MB),
  health-poll cache, ruff + CI, test matrix theo app (`10.01` §3: 186 file/~2245
  methods, ⚠ số đo 2026-10-14 chưa đo lại).

## 4. Đồng bộ tài liệu (làm cùng phiên này)

- `13.01` §1: thêm dòng Wave 0–4 + triệt để (quy trình 00.03: cập nhật bảng mỗi
  khi slice merge).
- `13.02`: thêm N-003 (prose lệch máy đo) + N-004 (claim chết), đủ 4 cột
  mã → bằng chứng → ảnh hưởng → slice trả nợ.
- Ledger Entry 324 + claim `doc-tongket` → done sau merge.
- `PLAN_MULTI_BROKER_SYNC_20261014.md` §4: cập nhật Wave 1–4 → ĐÃ XONG kèm PR
  (file UTF-8 sạch — kiểm byte thật; ký tự hỏng trước đó chỉ là console cp1252
  đọc sai, không phải file hỏng).
- KHÔNG thêm allowlist encoding để lấy xanh (cấm theo header allowlist).
