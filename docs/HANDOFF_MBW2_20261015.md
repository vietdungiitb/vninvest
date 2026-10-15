# HANDOFF — Phiên kế tiếp sau Wave 2 Broker Hub UI (PR #149 merged)

- **Ngày:** 2026-10-15 · **Người bàn giao:** PM/supervisor Wave 2
- **Trạng thái:** Wave 0 ĐÓNG · Wave 1 ĐÓNG (PR #146, #147) · **Wave 2 ĐÓNG (PR #149 merged `f97b3280b`)**.
  Migration head: **0029** (Wave 2 FE-only, không migration). `vnbroker==3.7.2` (gate 3.8.0 giữ).
- **Chuỗi ledger:** Entry 317 (Wave 1) · 318 (kế hoạch Wave 2) · 319 (audit AGREE) · **320 (Wave 2 DONE)**.

## 1. Đã xong trong phiên này (đọc WORKLOG_MBW2_20261015.md trước)

- Audit độc lập kế hoạch Wave 2 theo skill multi-agent-workflow: vòng 1 NEED_REVISION (9 obj) → sửa hết → vòng 2 AGREE. File: `PLAN_WAVE2_BROKER_HUB_20261015.md`, `PLAN_AUDIT_WAVE2_20261015.md`, `TEST_REPORT_WAVE2_20261015.md`, `REPORT_FINAL_WAVE2_20261015.md`, `PROGRESS_audit-wave2.md`.
- Thực thi Wave 2 một chu trình khép kín: 2 agent song song (HUB: B2.1/B2.2/B2.6; DATA: B2.3/B2.4/B2.5+adapter) → cross-review độc lập 2 vòng (bắt 1 blocker thật: `brokerHub:` trùng key → đã gộp + RUNTIME-12/12) → 1 PR #149 merged.
- Gates cuối trên cây merge: vitest 46/46 · tsc 0 · build PASS · bundle 1355.1/1350.7 KB (≤1450) · i18n:scan:strict 0 · dead-link 0 sót · regression BE VPS 61/61 (DB `mbw2_reg` đã dọn) · pre-push 22/22.
- Cleanup xong: nhánh local + remote đã xoá, worktree agent đã gỡ (đúng thứ tự junction-trước), VPS chỉ còn `/opt/vninvest` nguyên vẹn (có file `compose.staging.env.bak.*` untracked có sẵn — không đụng).

## 2. Việc kế tiếp: Wave 3 — Cô lập & gộp danh mục (P1, ~5 ngày)

B3.1 UI bind/gộp explicit + confirm · B3.2 `aggregate` chỉ đọc · B3.3 Watchlist scoped (chi tiết PLAN mục 5) · B3.4 migration contract NULL → NOT NULL khi backfill sạch. Đọc PLAN mục 4 + ADR-005/007 trước khi khai claim.

## 3. Nợ phải trả (ticket mở, chưa ai làm)

| Ticket | Nội dung | Gốc |
|---|---|---|
| BE-READ (Wave 3) | Bindings thiếu read-endpoint (BE PATCH-only) | WORKLOG_MBW2 §2/BE-01 |
| BE-KIND (Wave 3) | Expose `kind` + per-row `source` (AC5 hiện partial fail-closed) | BE-02 |
| FE-MERGE | Hợp nhất `BrokerSettingsSection` (Wave 1) với form/tile hub | HUB SUMMARY §Ngoài-scope |
| FE-DUPID | Trùng id `portfolios-manage` trong routeCatalog | HUB SUMMARY §Rủi ro |
| FE-STATUS | Filter Khớp lệnh `{FILLED,MATCHED}` có thể thiếu status SSI/TCBS | DATA SUMMARY §6 |
| TEST-E2E | E2E 2 SubAccount thật (AC1/AC2/AC5-E2E) | CHƯA CHẠY |

## 4. CHƯA CHẠY (đừng báo PASS)

E2E 2 SubAccount thật · FE trên VPS (thiếu node_modules — slice FE đầu Wave 3 phải chứng minh + sửa runbook §12.4) · full BE suite · ruff.

## 5. Bẫy đã gặp trong phiên (đừng lặp lại)

1. `global-config-drift` FAIL lặp lại 3+ lần ở mọi checkout (deployed-copy `~/.opencode` stale, không phải code) → lệnh chuẩn: `node tools/opencode-global/deploy.mjs` + `node scripts/verify-global-config.mjs` (ngoài repo, 0 file đổi). Đừng `--no-verify`.
2. 2 worktree không checkout chung 1 branch được → agent có nhánh riêng merge vào nhánh tích hợp (giữ 1 PR).
3. PowerShell không có `grep/tail/&&`; quote kép lồng trong SSH vỡ lệnh → pipe stdin / Select-String.
4. `git checkout --` cấm dùng (mất việc chưa commit) — dùng `git show HEAD:<f> > <f>`.
5. Viết file xong kiểm `git diff --numstat` trước stage (tránh vỡ EOL cả file).
6. Auditor Task chỉ thấy checkout của supervisor — worktree agent phải merge vào nhánh supervisor TRƯỚC khi gọi audit hợp nhất.
7. Đếm key i18n bằng leaf-name trúng nhầm — resolve runtime bằng node import mới là bằng chứng.
8. Claim viết tắt `.../test_x.py` hay chữ tự do bị gate cảnh báo — ghi path đầy đủ.

## 6. Quy trình VPS đã chứng minh (dùng lại nguyên văn)

```bash
# Tạo worktree + DB tạm:
git -C /opt/vninvest worktree add /tmp/wt-<slice> origin/<nhanh>
# (DB: echo CREATE DATABASE <db> | docker exec -i vninvest-core-db psql -U vninvest -d postgres)
# Chạy (BE): docker run --rm --network vninvest-staging_vninvest_network \
#   -v /tmp/wt-<slice>/packages/core/backend:/app \
#   -e CORE_DATABASE_URL=postgresql://vninvest:${PW}@vninvest-core-db:5432/<db> \
#   -e DJANGO_DEBUG=1 -e DJANGO_SETTINGS_MODULE=vninvest_core.settings \
#   --entrypoint python vninvest-core-api:staging \
#   -m django test <labels> --noinput
# (PW server-side, không quote lồng; -m django chữ thường)
# Dọn: DROP DB + worktree remove --force + prune
```
