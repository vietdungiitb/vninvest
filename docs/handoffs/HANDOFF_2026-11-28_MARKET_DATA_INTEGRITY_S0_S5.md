# HANDOFF 2026-11-28 — Market Data Integrity / Market CVD / Whale SSOT (S0–S5)

- **Trạng thái:** `temporarily stopped` — **S0–S5 xong code + re-audit, 5 PR mở, chưa merge**. **S4/S6 bị khóa** chờ Owner/coordinator.
- **Repo / base:** `vninvest` · `origin/dev @ 4516ab819` (lúc ghi handoff). Các slice xây trên `d446515b2 → a468cc2c2`, đã rebase từng nhánh.
- **Worktree liên quan:**
  - `D:\Mujoco Projects\wt\mdi-plan-1127` · `docs/mdi-plan-1127` (PR #586)
  - `D:\Mujoco Projects\wt\m01-bar-overwrite` · `feat/m01-bar-overwrite` (PR #591)
  - `D:\Mujoco Projects\wt\m02-auction-isolation` · `feat/m02-auction-isolation` (PR #596)
  - `D:\Mujoco Projects\wt\m03-tick-dedup` · `feat/m03-tick-dedup` (PR #600)
  - `D:\Mujoco Projects\wt\m05-market-cvd` · `feat/m05-market-cvd` (PR #609)
- **Nguồn yêu cầu:** RFC `BE_REQUEST_MARKET_DATA_INTEGRITY_CVD_WHALE_2026-11-27.md` + audit phản biện (worktree widget `D:\Mujoco Projects\wt\be-req-market-data-integrity-1127`, chỉ đọc).
- **SSOT quyết định:** `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` REV.3 + `docs/evidence/market-data-integrity/CONSENSUS_1127.md` (G-1..G-4, Q1..Q9).

## 1. Kết quả đã đạt

| Slice | PR | Entry | Exit criteria | Re-audit |
|---|---|---|---|---|
| S0 doc | **#586** | 678* | plan REV.3 + 3 audit + consensus; phát hiện G-1..G-4 | 3 vòng → `AGREE` |
| S1 `REQ-BE-M01` | **#591** | 681 | fail-before `1000 != 501000` → pass 4/4; G-3a UTC 2H/4H | `AGREE` |
| S2 `M02+M04+Q6` | **#596** | 682 | 6 đỏ → 13/13 xanh; ATO/ATC → UNKNOWN 3 write-path; total&whale bỏ side lạ; whale 500M | `AGREE` |
| S3 `M03+G-2` | **#600** | 683 | dedup_key + `seq_in_key`; 3 row trùng→3 key; partial unique index | 2 vòng → `AGREE` |
| S5 `M06/07/08` | **#609** | 684 | Market CVD từ tick; 8 field mới; `?metric=` additive default `whale`; cache v5/v3; retention 365 | 3 vòng → `AGREE` |

> *Entry 678 bị agent khác chiếm trên `dev` trước khi S0 merge — re-check số Entry lúc merge.

**Thứ tự G-1:** S5 chạy **trước S4** → khi mở backfill chỉ cần **1 lần DNSE**, phục hồi đồng thời `IntradayBar` + `WhaleAlertCanonical` + `SessionFactsBucket(full_tick)`.

**Bằng chứng:** `docs/evidence/market-data-integrity/{s1-gates.md,S1_REAUDIT.md,s2-gates.md,S2_REAUDIT.md,s3-gates.md,S3_REAUDIT*.md,s5-gates.md,S5_REAUDIT*.md}` — mọi con số kèm lệnh/exit code; fail-before chạy trên VPS DB tạm theo `docs/STAGING_VPS_RUNBOOK.md` §12.3, dọn sau mỗi lần. **Không đụng dữ liệu staging thật.**

## 2. Cổng đã chạy / `CHƯA CHẠY`

- Đã chạy: `check-multi-agent` exit 0; `pre-push-gate` 36 PASS/0 FAIL (sau rebase từng nhánh); `makemigrations --check` = No changes; `check-system-design --check` SACH (153 migration sau S3+S5); `py_compile` các file đổi; BE test VPS DB tạm (4/4, 13/13, 7/7, 8/8); migration end-to-end S3.
- **CHƯA CHẠY merge PR** · **CHƯA deploy staging** · **CHƯA probe read-only** `/session-facts/cvd/?metric=...` · regression full bị chặn bởi image staging thiếu `vninvest_core.utils.encryption` (lỗi môi trường, đã ghi trong `s3-gates.md`).

## 3. Reservation / nợ cho phiên sau

| ID | Nội dung | Người đóng |
|---|---|---|
| R-1 | **Merge 5 PR #586/#591/#596/#600/#609** vào `dev` (merge-commit, không squash); re-check số Entry (678/681–684 có thể bị chiếm) | Coordinator/Owner |
| R-2 | **S4 vẫn KHÓA**: chỉ viết code + unit test sau khi S1+S2+S3+S5 deploy xong; **CẤM ghi/xóa staging** ch tới Owner duyệt `--dry-run` + snapshot 4 bảng cho `VIC/FPT/VNM` | Owner |
| R-3 | **S6** reconciliation 15:15 ICT (`I-1..I-6`) — chưa mở, làm cuối | Owner/coordinator |
| R-4 | Nợ kỹ thuật: path scheduler `realtime_prefetch` chỉ gửi `intraday_ticks` nên không recompute bar (R1-S1-01); migration `market_serving/0007` vẫn 200M + mẫu số cũ; tie-order provider trong cùng giây; source label helper lệch `synthesize` path | Ticket riêng |
| R-5 | Probe staging read-only sau deploy để xác nhận I-1/I-3/I-4 & `?metric=market` | Coordinator |
| R-6 | Agent khác vẫn `in-progress` trên checkout chính: `broker-config-r1` (file `SocBrokerPanel.tsx`, ledger...). **KHÔNG đụng** các file đó; phiên sau đợi agent này xong rồi mới rebase/merge tiếp | Coordinator |

## 4. Agent còn lại — trạng thái lúc ghi handoff

- `git status` checkout chính: `M docs/CODE_CHANGE_AUDIT_LEDGER.md`, `M packages/web/src/components/soc/SocBrokerPanel.tsx`, 4 file docs untracked — thuộc agent `broker-config-r1` (claim `in-progress`, `docs/CLAIMS.md:2061`).
- Nhiều worktree cũ vẫn tồn tại (`price-*`, `whale-*`, `cvd-tv-analysis-plan`, ...); phần lớn là stale, nhưng **không tự xóa** khi chưa có lệnh cleanup.
- **Yêu cầu phiên sau:** chờ agent `broker-config-r1` (và bất kỳ agent nào khác đang chạy) báo done, chạy `pwsh -File scripts/agent-sync.ps1`, re-verify `git status`, rồi mới merge 5 PR theo R-1.

## 5. Next steps (khi tiếp tục)

1. Xác nhận agent còn lại đã xong → `git status --short` sạch trên checkout chính.
2. Merge PR #586 → #591 → #596 → #600 → #609 (thứ tự phụ thuộc; merge-commit).
3. Deploy staging qua `bash scripts/deploy-staging.sh --verify` (Owner/Q8).
4. Probe read-only §6.1 RFC; **S4 vẫn khóa** cho tới khi Owner duyệt dry-run.
5. Chỉ sau S4 mới mở S6 (`test_reconciliation_invariants.py`, beat 15:15 ICT).

**Owner/Next-session owner:** coordinator vninvest BE. **Không có code/staging thay đổi trong slice handoff này.**
