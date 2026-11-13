# HANDOFF — Đợt 2 backend (S1.1 + S2.1 + S3.1 nhánh B) — slice `dot2-backend-20261113` (2026-11-13)

> **Ngày:** 2026-11-13 · **Trạng thái:** xong, chờ merge PR → `dev`
> **Claim:** `dot2-backend-20261113` = `done` · **Branch:** `feat/dot2-backend-20261113` → `dev`
> **Worktree:** `D:/Mujoco Projects/vninvest-wt-dot2` (xóa sau merge)
> **Plan:** `docs/PLAN_DOT2_BACKEND_20261113.md` (rev 2) · **Evidence:** `docs/evidence/dot2-backend-20261113/` (audit B3 + b8-reaudit PASS)
> **Ledger:** Entry 478 · **Audit:** B3 NEED_REVISION → rev 2 → B8 PASS

---

## 1. Đã làm (Owner toàn quyền, solo)

1. **P1 — round-2 `w0-6`:** verify-equivalence (dev đã có toàn bộ substance) → KHÔNG merge → xóa remote branch + 2 branch stale local. Hết chặn backend.
2. **P2 — S1.1 B-5 (D2 FINAL):** quote đơn/price-board/batch/profile price → JSON number (`_num`, `None`→`null`). Điều kiện V1 đạt (FE `Number()`-safe).
3. **P3 — S2.1 B-2 (D1b FINAL):** depth-chart trả rỗng trung thực (`[]/[]/null/unavailable` + note), xóa sinh số giả + `is_mock`. FE badge/spread guard. Test cũ khóa hành vi dối → viết lại.
4. **P4 — S3.1 nhánh B:** bars `adjusted:false` + note (theo probe QB2). Timeframe chart giữ nguyên (defer có lý do).
5. **Đóng slice:** ledger Entry 478 · claim done · PR merge-commit → dọn worktree.

## 2. Gates chạy thật

| Gate | Kết quả |
|---|---|
| BE contract mới (VPS, DB tạm `dot2_b01`) | fail-before 4 đỏ đúng lý do → pass-after **5/5** |
| BE hồi quy (VPS): workstation + w0_6 | **26/26** |
| BE hồi quy (VPS): market_serving + bars | **90/90** |
| FE widget estimated (VPS) | **3/3** (1 đỏ giữa chừng do guard sai chỗ → sửa → xanh) |
| `tsc --noEmit` (VPS) / `eslint` 2 file (VPS) | 0 / 0 |
| `ruff` file mới/sửa | sạch (E741 tự sửa; E402/F401/F841 còn lại pre-existing) |
| `makemigrations --check` | KHÔNG drift mới (drift LicenseKey/0008 pre-existing từ LP1 — ticket license team) |
| Local: multi-agent 0 · ledger 0 · lessons 0 · eol 0 · secrets 0 · light-theme 0 · i18n 0 (309/309) · page-registry 0 | PASS |
| `pre-push-gate` full / full BE suite / full FE suite | CHƯA CHẠY (timeout local / 0 migration; chỉ chạy scope ảnh hưởng) |

## 3. Phát hiện quan trọng

- **Verify-equivalence > merge mù:** 6 commit "unmerged" nhưng substance đã trong dev (PR #280) — merge sẽ chỉ gây ồn. Pattern này nên thành checklist khi gặp branch stale có PR merged.
- **Claim row `:1938` còn chữ "merge w0-6"** (lịch sử claim, giữ nguyên) — thực tế đã chuyển sang delete-branch; entry này + plan §0/§5 ghi rõ, đừng ai merge nhánh đã xóa.
- **Dọn VPS đã verify:** DB DROP · worktree remove+prune · file tạm xóa · không container thử nghiệm.

## 4. Việc còn lại / Next steps

1. **Slice riêng:** S2.2 B-4 (fundamentals typed) · S3.2 B-6 (PAT scope + đóng schema) · S4.x (C2/C3/E2E/visual/deploy) — chờ slice này merge.
2. **Ticket license team:** tạo migration `0008 LicenseKey` (drift pre-existing từ `205867b84`) — đừng để agent backend tự sinh trùng số.
3. **Ticket coordinator:** `/tmp/wt-gatep0*` cũ của slice gate-p0 còn trên VPS.

## 5. Evidence

- Plan rev 2: `docs/PLAN_DOT2_BACKEND_20261113.md` (§10 mapping)
- Audit B3: `docs/evidence/dot2-backend-20261113/audit.md` (NEED_REVISION 2+3 reservation)
- Re-audit B8: `docs/evidence/dot2-backend-20261113/b8-reaudit.md` (PASS)
- Ledger: Entry 478
