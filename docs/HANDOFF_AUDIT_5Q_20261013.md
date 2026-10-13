# HANDOFF — Audit 360 + 5 quyết Owner (D-01, màu, usage, CORS, recharts)

- **Ngày:** 2026-10-13 (tiếp nối `docs/HANDOFF_20261013.md`, không thay thế)
- **DEV hiện tại:** `aa4d7e477` (merge `feat/audit-followup-5q`, đã push `origin/dev`)
- **Ledger:** `## Entry 282` (mới nhất trên dev) · **Claim:** `audit-followup-5q` = `done`
- **Lessons áp dụng:** L-V01, L-V02, L-G02, L-G04, L-G07, L-T01

## 1. Đã xong và đã merge dev (khỏi làm lại)

| # | Việc | Commit/file | Gate thật |
|---|---|---|---|
| 1 | Chốt màu **đỏ=giảm** | `soc.tokens.css` (xóa khối cảnh báo, ghi Owner chốt) | eslint 0 |
| 2 | Unify 11 routeId `main.tsx` theo `routeCatalog` (D-01) + test ngược `main→catalog` | `main.tsx`, `routeCatalog.js` (+entry `portfolios-manage`), `route-catalog-contract.component.test.ts` | vitest 2 file/11 test PASS, tsc 0, eslint 0 |
| — | Full gate trước push | `git push feat/audit-followup-5q` | **pre-push-gate 21/21 PASS** |

Chi tiết: `docs/CODE_CHANGE_AUDIT_LEDGER.md` `## Entry 282`.

**2 đính chính audit (đừng trích bản cũ):**
- (a) Báo cáo audit ghi "chuẩn VN là đỏ=tăng" là **SAI** (đó là chuẩn TQ). Bảng giá VN: xanh lá=tăng, đỏ=giảm, vàng=TC, tím=trần, xanh dương=sàn. Token hiện tại đúng sẵn.
- (b) D-01 chỉ là **id-drift contract, không phải lỗ hổng live**: `routeCatalog` runtime chỉ export qua `src/index.js:2` + 2 contract test, không gate capability nào đọc theo id; phân quyền thật ở BE.

## 2. Còn chờ Owner (chưa code — đừng tự làm)

- **(3) POST `/ai/usage/`:** giữ nguyên. FE không có caller POST (`workspace.js:742-760` toàn GET). Owner chọn **(A)** gỡ hẳn → 405 hay **(B)** staff-only.
- **(4) CORS/tenant:** ý kiến đã đưa — `CORS_API_DYNAMIC_ALLOW` default `false` ở prod; `tenant=None → qs.none()` trừ 2 view support có lý do + audit. Chờ Owner chốt "làm theo".
- **(5) Gộp recharts:** 9 file (6 tenant-admin + `AdminAnalyticsPage` + `AIUsageDashboard` + `OrderFlowRadarPanel`). Migrate sang echarts + xóa dep (chạm `package.json` deny-list) → slice riêng, lệnh kickoff: **"kickoff recharts"**.

## 3. Cảnh báo cho session sau (đọc trước khi sửa)

1. **PR #121 (`feat/pf-manage-rebuild`, 16 commit chưa merge) sẽ CONFLICT:** nhánh đó giữ `## Entry 282/283/284` riêng (dev giờ đã có Entry 282 của slice này) → rebase phải đánh lại số; `main.tsx` của họ dùng routeId cũ (`portfolios-broker`) → phải đổi sang `portfolios-manage-broker` nếu không test ngược đỏ. Chi tiết trong Entry 282 §CANH BAO.
2. **Repo đã PUBLIC** (`isPrivate: false`, đo 2026-10-12 trong dòng `coordinator-rescue` của `CLAIMS.md`) → điều kiện hoãn rotate P0-SEC-01 ("repo private", Owner chốt 2026-10-07) **không còn đúng**. `CORE_PAT_PEPPER` vẫn trong history đang dùng. Cần Owner mở lại quyết định rotate.
3. **Nhánh cũ `feat/pf-manage-rebuild`** còn 2 commit của slice này (`edb40020a` claim, `a30a7cd44` code) — chỉ là provenance, code thật đã transplant sang `feat/audit-followup-5q` và merge. Đừng merge nhánh cũ vào dev (kéo theo 16 commit của phiên khác).
4. **L-T01 tái phát 1 lần trong phiên:** Edit tool đổi LF→CRLF/mixed ở 2 file (numstat 185/189). Đã fix bằng `normalize-eol` (chỉ tồn tại trên nhánh cũ, **chưa có trên dev** —session sau nếu gặp thì `git show` + convert tay về LF của blob gốc). Trên dev lần này Edit giữ LF, numstat sạch (26/13, 5/3, 19/0, 5/9).
5. `POST /ai/usage/` + `CORS_API_DYNAMIC_ALLOW=true` + `TESTING` fail-open vẫn còn nguyên trên dev (ngoài phạm vi slice này).

## 4. Lệnh kiểm tra nhanh

```bash
git log --oneline -3                    # dau phai aa4d7e477
npx vitest run src/components/__tests__/route-catalog-contract.component.test.ts  # 3/3 (packages/web)
npx tsc --noEmit                        # exit 0 (packages/web)
node packages/web/scripts/check-multi-agent.mjs   # 0 loi
```
