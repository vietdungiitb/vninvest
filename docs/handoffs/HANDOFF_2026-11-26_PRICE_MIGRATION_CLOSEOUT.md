# HANDOFF — Price normalization: re-audit & closeout (2026-11-26)

- **Phạm vi**: toàn bộ phiên 2026-11-25/26 — M0 bulk CafeF → M1 diff → M2 schema → M3 guard → M4 apply → M5 consumer → M6a/b/c → cutover runtime → hotfix DailyPrice → re-audit.
- **Branches**: `dev` = `8c8a12b4b` (sau PR #553); `main` = `f4be18486` (cập nhật ở PR #554).
- **Trạng thái**: **done** cho mọi hạng mục bắt buộc; chỉ còn residual đã ghi rõ, không blocker chốt phiên.

## 1. Kết quả + evidence (file:line)
| Hạng mục | Kết quả | Evidence |
|---|---|---|
| Bulk/diff | 2.308.756 dòng CafeF; dry-run 2022 matched 360.329 | `m0-bulk-coverage.md:16,42`, `m1-diff.md:9-22` |
| Apply | HOSE 2022 91.808 + HOSE 2021 87.947 → toàn 3 sàn **1.904.487** dòng `cafef`, `bad_cafef=0` | `m4-apply-20261125.md:13-39`, `m4-verify-db-2022.json:1`, `m4-apply-2021-hose.md:12-34`, `m4-apply-all-and-cutover.md:14-43` + phụ lục script cuối file |
| Consumer | serializer/points/bars → NAV quantity theo ngày → advisory/screener → FE scale; audit O1/O2 đóng | `m5a-read-contracts.md`, `m5b-domain-consumers.md`, `m5c-fe-cutover.md`, `m6b-readiness.md:16-17` |
| Guard | `price_source in ('cafef','unmapped_cafef')`; query plan `date__range` (744s → 33,9s) | `m6a-guard-unmapped.md`, `m6c-query-plan.md` |
| Cutover | flag `1/0`, migration `advisory/0024` + `user_workspace/0031`, FE dist, `cache.clear()` | `m4-apply-all-and-cutover.md:31-40`, Entry 641 |
| E2E | API `/chart` 200 + `adjusted_display=true` + TPB `17940`; visual chart 2.145 nến, ảnh đã mở | `m4-apply-all-and-cutover.md:40`, `m5c-chart-e2e-20261125.png` |
| Hotfix | `UnboundLocalError` DailyPrice → import method-scope + test 1D, PR #552 merged | `dailyprice-unbound-hotfix.md:6-16`, Entry 642 |
| Re-audit | O-01 (ledger tự mâu thuẫn) + O-02 (compose flag chưa lên dev) đã đóng | Entry 643, PR #553 |

## 2. Đính chính re-audit
- Entry 641 nói visual E2E "CHƯA CHẠY" → **sai**; đã append Entry 643 (append-only, không sửa Entry cũ).
- Entry 635 "FE 2/2" → thực tế **3/3** (`m5c-gate-logs.txt:7`).
- `CLAIMS.md` claim `price-mig-cutover` trỏ file ghosts `m5-cutover.md` → sửa thành `m5a/m5b/m5c*.md`.
- `docker-compose.staging.yml` truyền flag trước đây chỉ ở VPS local commit → đã lên `origin/dev` PR #553 (trailer `Claim-Deny-List:`).

## 3. Residual / rủi ro (không chặn, cần owner theo dõi)
1. 4 lô lỗi nguồn CafeF (HNX 2012, UPCOM 2011/2014/2015) giữ `vnbroker_legacy`; 5 lô có 0 dòng nguồn (HNX 2023–2026, UPCOM 2026) — chỉ xử lý khi CafeF cung cấp lại.
2. Core-api/DB memory 4GB/12GB, `BATCH=500`, image `cutover` là runtime-only trên VPS — deploy fresh từ `dev` sẽ dùng code đã merge nhưng cần set lại flag/env/profiles; đối chiếu compose.staging.env (untracked) với bản mẫu.
3. Beat + 3 worker báo `unhealthy` do healthcheck `curl :8100` (chỉ API có HTTP server); scheduler vẫn chạy.
4. Widget nhãn "Chưa điều chỉnh" (host map `adj_close` vào `close` theo thiết kế M5c); 404 `/core/v1/advisory/latest/TPB/` — outside scope.

## 4. Next steps / owner
- Owner ký nhận residual mục 3 trong phiên tiếp theo (chưa có sign-off riêng trong evidence).
- Nếu cần rollback: tắt `PRICE_ADJUSTED_DISPLAY`, đặt `PRICE_MIGRATION_PAUSED=1`, restore S0 `before_20261124.dump` (sha256 `6c5a7e05…c19691`) hoặc theo `inserted_keys` — **chỉ khi có owner sign-off**.
- Không mở rộng sang migrate dữ liệu mới khi chưa có nguồn CafeF ổn định cho 7 lô nói trên.
