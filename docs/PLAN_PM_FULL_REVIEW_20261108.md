# PLAN PM FULL REVIEW 20261108 — L0-L4 doc-only, static trước (rev1 sau B3/B8)

> Ngày: 2026-11-08 · Branch: `feat/pm-review-20261108` (sạch trên `dev` `983b8c270`, đã gỡ 13 commit uiux) · Claim: `pm-review-20261108` (`docs/CLAIMS.md`, 2 commit `0b7cb2522` + sắp tới)
> Vai trò: PM chịu trách nhiệm cao nhất, quản lý BE/FE
> Phạm vi: toàn repo `vninvest` (BE `packages/core/backend/src` 16 app · FE `packages/web/src` 69 route · 3 package phụ · test/CI/security · contract FE↔BE)
> Output: `docs/PM_FUNCTIONAL_TREE_20261108.md` + `docs/PM_BUG_GAP_MATRIX_20261108.md` + `docs/PM_ROADMAP_UPGRADE_20261108.md` + ledger Entry 417 (rev1)
> Lessons áp dụng: [L-001, L-002, L-003, L-007, L-V01, L-V02, L-V04, L-V09] · Owner đã chốt: L0-L4 chi tiết nhất · Static trước · 3 file tách riêng

## 1. Mục tiêu + bằng chứng đã tự mở đọc

- Mục tiêu: dựng cây phân cấp L0-L4 từng chức năng nhỏ nhất, xác định bug lỗi/gap theo từng chức năng, báo cáo hiện trạng + hướng cải tiến nâng cấp.
- Evidence: `docs/MASTER_TRACKING_2026Q4.md:1-120` + `docs/ROADMAP_MASTER_2026Q4_2027.md:85-104` + `docs/OPEN_WORK_20260927.md:134,493` + 4 subagent read-only + B3/B8 audit refute 6 blocker (`ses_e47195254d6f61c1`, file:line trong 3 file báo cáo rev1).

## 2. Tiêu chí nghiệm thu (Given/When/Then)

- `Given` cây L0-L4 + matrix bug/gap có `file:line` hoặc ghi `CHƯA XÁC MINH` · `When` auditor độc lập đọc lại mọi số liệu · `Then` 0 blocker + 0 major mới qua B4.
- Số đếm tách mức độ (L-G04), route đếm theo registry (L-G07), không báo PASS cho thứ chưa chạy (L-G02).

## 3. Baseline exit-code đã đo (rev1 — đo lại trên `dev` sạch nhánh)

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Quy trình | `node packages/web/scripts/check-multi-agent.mjs` | **exit 0 PASS** (0 lỗi, 15 app) — đo 2026-11-08 (rev1) |
| Lessons | `node scripts/check-lessons.mjs` | **exit 0** (14 file \| 57/60) — đo 2026-11-08 (rev1) |
| Type-check | `npx tsc --noEmit` (`packages/web`) | **exit 0** — đo 2026-11-08 (rev1) |
| Git | `git status --porcelain` | sạch (trước claim) · nhánh sạch trên `dev` sau rebase |
| BE full | `MASTER_TRACKING:267` | `3468 / 12 / 224` + Entry 415 VPS (`427+620+1074+508+314+32 OK`, PR #299) — **CHƯA CHẠY LẠI** (static, W0 chạy) |
| FE vitest | `MASTER_TRACKING:267` | `1179 passed / 5 failed` — **CHƯA CHẠY LẠI** |

## 4. SCOPE + LIMIT + non-goals + rollback

- **SCOPE (chỉ doc):** `docs/PLAN_PM_FULL_REVIEW_20261108.md` · `docs/PM_FUNCTIONAL_TREE_20261108.md` · `docs/PM_BUG_GAP_MATRIX_20261108.md` · `docs/PM_ROADMAP_UPGRADE_20261108.md` · `docs/CLAIMS.md` (claim) · `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 417)
- **LIMIT:** 3 vòng sửa kề nhau, quá thì `blocker` + dừng. **Rev1 là vòng 1** (B3/B8 NEED_REVISION → sửa lại).
- **Non-goals:** không sửa runtime, không migration, không `npm/pip install`, không chạy staging/live order, không đụng deny-list, không rotate secret, không bật CI.
- **Rollback:** xóa 3 file doc mới (không ảnh hưởng runtime).

## 5. Checklist lessons (đã tick)

MANDATORY CHECKLIST — xem skill `project-lessons` Step 4:
- [x] File định sửa có trong deny-list §2? — Không (chỉ doc mới + ledger append, huyện 2026-10-03 được phép)
- [x] `git status` sạch + commit claim riêng TRƯỚC dòng đầu tiên? — Đã làm (`0b7cb2522` trên nền `dev` sạch)
- [x] Rebase → check migration → gate? — Rev1 **đã rebase sạch trên `dev`** (gỡ 13 commit uiux `0b42f2ad8`), conflict 1 file ledger đã xử lý bằng reset + re-apply (không `checkout --` hủy việc)
- [x] Thiếu DB/env → `CHƯA CHẠY`? — BE/FE test ghi CHƯA CHẠY, không suy ra được
- [x] Script đo có control? — Số occurrence 418 vs 369 ghi `CHƯA XÁC MINH`; con số 837 LOC/17 endpoint/10⁄10 exports đã thay bằng số đo rev1 (Shell 1263/1026, partner 110, exports đã sửa) (L-V01)
- [x] Tái hiện lỗi trước khi kết luận? — /ai/agents 404, depth mock, SAML stub có file:line; root cause kế thừa chưa tái hiện ghi CHƯA XÁC MINH (L-V02); không đọc thiếu `include` gián tiếp (L-V09) — rev1 đã đọc đủ `vninvest_core/urls.py:65` + `contracts/operator/urls.py:17` + `identity_access/urls.py:75`
- [x] Sau mỗi lệnh ghi file: `git status` lại? — Có

## 6. Phương pháp (B1-B6)

B1 đo lường (git + check-multi-agent + đọc MASTER/ROADMAP/OPEN_WORK) → B2 plan này → B3 audit độc lập (NEED_REVISION 6 blocker) + B4 đồng thuận Owner → B5 claim (rev1 `0b7cb2522` sạch trên `dev`) → B6 code = sửa 3 file doc (không code runtime) → B7 gates (`check-multi-agent`, `tsc --noEmit`, `check-lessons`) → B8 re-audit → B9 claim done + ledger + PR.

## 7. Tiến độ (rev1)

- [x] B1 đo lường + 4 subagent evidence (4/4 về)
- [x] B2 plan (file này) + Owner chốt L0-L4/static/3 file
- [x] B3 audit NEED_REVISION (6 blocker) + B4 đồng thuận sửa rev1
- [x] B5 claim sạch trên `dev` (`0b7cb2522`, gỡ 13 commit uiux)
- [x] B6 sửa 3 file báo cáo theo audit (SOC refute, SAFE-04 closed, loadError refute, M2-05/M9-02/W0.5 sửa, số thật partner/api/ads/Shell, thêm M2-06/M2-07)
- [x] B7 gates (rev1): `check-multi-agent` PASS + `tsc --noEmit` exit 0 + `check-lessons` exit 0
- [ ] B8 re-audit verdict (chờ auditor độc lập xác nhận NEED_REVISION → PASS)
- [ ] B9 claim done + ledger Entry 417 + push/PR

## 8. Câu hỏi cần làm rõ (rev1 — còn 3 câu thật cho Owner)

| # | Câu hỏi | Vì sao giữ lại |
|---|---|---|
| Q2 | Depth 3 mức giả lập + `pe/pb/roe=0` + lịch sử < 1 năm — sửa nguồn dữ liệu thật ở W1 hay gắn nhãn `Ước tính / Demo` trước? | Product/Timeline (D6). |
| Q3 | Rotate `CORE_PAT_PEPPER` (11 commit) + `DNSE_CREDENTIAL_FERNET_KEY` (7 commit) và nạp billing GH Actions? | Infra/Ops ([X1],[X2]). |
| Q5 | Mobile scaffold giữ hay xoá? `/core/v1/ai/agents/` dựng BE thật hay gỡ UI? SAML `xmlsec` sửa Dockerfile hay gỡ khỏi runbook? | Kiến trúc W0.6/W2.1. |
| — | ~~Q1 SAFE-04 merge chưa?~~ (đã merge `b59027a14`) · ~~Q4 108 route~~ (đã đếm 110 + mount trùng, chỉ hỏi lộ diện UI Tenant Admin) | Không hỏi nữa |
