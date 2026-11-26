# PR REVIEW & CLOSE — broker-config-r1 (2026-11-26)

## Trạng thái PR (nguồn: GitHub CLI, chạy thật)

```
gh pr view 560 --json state,mergedAt,mergeCommit,reviews
```

- `state`: **MERGED**
- `mergedAt`: `2026-11-26T12:56:53Z`
- `mergeCommit.oid`: `ad69124eeebda72eee9ebd80c6c954674806040c`
- Base `dev` · head `feat/broker-config-r1` · merge-commit (không squash).
- `reviews`: 1 comment từ `copilot-pull-request-reviewer` — nội dung: *"Copilot was unable to review this pull request because the user who requested the review has insufficient remaining quota."* ⇒ **không có human approval**; đây là bằng chứng thật, không tự bịa "approved".
- Trước merge, PR từng ở trạng thái `CONFLICTING` do `dev` tiến tiếp (`afbf4eb91`, `42beb6a4f`); đã rebase 3 lần, push `--force-with-lease`, cuối cùng `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`.

## Kiểm chứng sau merge (bằng chứng cuối)

- `git fetch origin dev && git log --oneline origin/dev -1` → `ad69124ee Merge pull request #560 from vietdungiitb/feat/broker-config-r1`.
- VPS `/opt/vninvest`: `git checkout dev && git reset --hard origin/dev`, deploy `REPO_BRANCH=dev bash scripts/deploy-staging.sh` → HEAD `ad69124ee`, BE container `grep -c api_secret /app/src/service_ops/views/broker.py` = **1**.
- E2E trên bản đã merge: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8081 npx playwright test tests/visual/broker-config-r1.spec.ts --project=chromium --reporter=line` → **2 passed / 29.4s**, 4 GET broker 200, không POST khi bấm Lưu với form rỗng.
- Ảnh `docs/evidence/broker-config-r1/e2e/broker-tabs-r2.png` đã mở kiểm tra: 3 tab, field riêng, không còn textarea JSON.

## Dọn dẹp

- Test DB `test_broker_config_r1_test`: `DROP DATABASE IF EXISTS` trên `core-db` → `test_db_dropped`.
- SSH tunnel `127.0.0.1:8081 → VPS:8080` đã đóng.
- Worktree `D:\Mujoco Projects\vninvest-r1-merge` đã remove (junctions xoá trước).
- User tạm `e2e_broker` (staging) đã xoá từ trước; E2E dùng `testuser` có tenant sẵn.

## Residual chuyển phiên sau

1. Cert public `docker.edusuccess.vn` trả `CN=erp.edusuccess.vn` (SNI sai) — ticket hạ tầng ACME/nginx-proxy; E2E phải dùng SSH tunnel.
2. F3: chiều ngược credential purposes → registry chưa cross-check.
3. S3–S5: poll job `test-connection`, redesign 4 bước, `expected_updated_at`.
4. Main tree hiện ở branch cũ `feat/broker-config-r1` với 2 file uncommitted của phiên khác — coordinator dọn; slice này không tự discard.
5. Handoff file trên `main` cần cherry-pick theo handoff rule — xem commit trong PR đóng phiên này.
