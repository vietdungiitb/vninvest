# Handoff — sau phiên cứu uncommitted work (2026-10-12)

> **Đọc file này TRƯỚC khi nhận session mới trong `vninvest`.**
> **PR #110 ĐÃ MERGED** (2026-10-12 00:38 UTC, merge commit `4d2ced70f`).
> Việc còn dở nằm ở §3.

---

## 0. Trạng thái `dev` sau merge (đã verify, không phải suy đoán)

```
origin/dev = 4d2ced70f  Merge pull request #110 from feat/rescue-admin-uncommitted
local dev  = 4d2ced70f   (fast-forward, worktree sạch)
```

Gate chạy lại **trên `dev` sau khi merge** (không dùng lại số liệu trước merge):

| Gate | Kết quả |
|---|---|
| `manage.py check` | 0 issues |
| `makemigrations --check --dry-run` | No changes detected |
| `scripts/check_admin_ux.py` | PASS — 0 lỗi, 0 cảnh báo |
| `tests.test_admin_ui` | **OK 45/45** |
| **pre-push-gate** | **21 PASS / 0 SKIP / 0 FAIL** |

Trước khi merge (trên HEAD của branch): BE **724 OK**, FE **918/918 PASS**, pre-push **21/21**, CI `scan` pass.

**Branch đã merge nên xoá xong:** `feat/rescue-admin-uncommitted`, `chore/vnbroker-pypi-372`, `fix/admin-uiux-audit` (local + remote).

> ⚠ **Còn ~30 branch cũ trên remote** (`chore/cleanup-*`, `docs/*`, `cleanup/code-health`…) — phần lớn đã merge từ lâu.
> **CHƯA xoá hàng loạt**: việc đó cần Owner xác nhận, vì nếu branch còn chứa commit chưa từng vào `dev` thì xoá là mất việc.
> Cách kiểm an toàn trước khi xoá từng branch:
> ```bash
> git merge-base --is-ancestor origin/<branch> origin/dev   # 0 = đã vào dev
> ```

---

## 1. Đã XONG trong phiên này

| # | Việc | Bằng chứng |
|---|---|---|
| 1 | Sao lưu 29 file uncommitted ra `%TEMP%/vninvest-rescue-20261012-054234` **trước khi làm gì** | 29 file + patch 273 KB |
| 2 | Khai claim `coordinator-rescue`, commit riêng | `04d585485` |
| 3 | Tạo branch `feat/rescue-admin-uncommitted` từ `origin/dev` (`95fe4b13b`) | rebase sạch |
| 4 | Audit + sửa 2 regression (xem §2) | `11716afdb`, test 45/45 |
| 5 | Sửa line-ending CRLF (L-T01) | compose 574/574→**11/11**, Dockerfile 78/66→**20/8** |
| 6 | Commit 8 file portfolio/QA/docs | `87aeeb580` |
| 7 | `Dockerfile`: build không bắt buộc `VNBROKER_GITHUB_TOKEN` | `bb76a1e93` |
| 8 | `docker-compose.dev.yml`: 11 service, token optional | `45bcb74aa` (`--no-verify` + trailer) |
| 9 | Ledger Entry 272 | `8e8abea54` |
| 10 | Chạy lại **toàn bộ gate sau rebase**, push qua pre-push hook thật, mở PR | **PR #110**, CI `scan` pass |

---

## 2. Regression đã tìm và sửa (đọc để không sửa nhầm lần sau)

`tests/test_admin_ui.py:368,426,428` assert class `vn-kpi__value` / `vn-kpi__value--error`.
Template mới đổi sang BEM 3 thành phần `vn-kpi-card__value` / `vn-kpi-card__value--error`
(`index.html:86,94`; CSS mới có đủ rule tại `vnadmin.css:4887-4993`).

**Bằng chứng đây là lỗi của code chưa commit, KHÔNG phải lỗi có sẵn:**

| | `origin/dev` (worktree sạch) | branch cứu |
|---|---|---|
| trước `collectstatic` | 15 errors (thiếu staticfiles manifest) | — |
| **sau `collectstatic`** | **OK 45/45** | 2 failures |

Đã sửa test theo **ý nghĩa giữ nguyên** (giá trị vẫn hiện khi mất link; lỗi vẫn đánh dấu; chỉ 1 thẻ lỗi) — **không** nới lỏng assertion.
**Fail-before đã chứng minh**: bỏ `vn-kpi-card__value--error` → AC4 FAIL; khôi phục byte-identical.

> ⚠ Nếu session sau thấy test này fail, **đừng xoá assertion**. Kiểm tra `index.html` còn dùng `vn-kpi-card__*` không.

---

## 3. CÒN TỔN ĐỌNG — xử lý theo thứ tự này

### 3.1 P0 — P0-SEC-01: repo đã thành PUBLIC (cần Owner quyết định)

**Sự thay đổi điều kiện.** `AGENTS.md` (2026-10-07) chốt *"không rotate lúc này"* **với điều kiện repo PRIVATE**.
Owner thông báo 2026-10-12 repo đã public. Đo lại:

```
gh repo view --json isPrivate,visibility
→ isPrivate: false, visibility: PUBLIC
```

**Trạng thái đo được:**
- Working tree **sạch**: `secret-scan` quét 3826 tracked file → 0 lỗi; CI `scan` **success**.
- **History vẫn có bí mật**:
  - `DNSE_CREDENTIAL_FERNET_KEY` — 44 ký tự, **đúng dạng Fernet hợp lệ**, trong `compose.dev.env`, bị untrack ở commit `2db35ed85` nhưng blob cũ vẫn còn trong history.
  - `CORE_PAT_PEPPER` — tiếp tục là khóa **đang dùng**.
- Đã kiểm: `settings.py` chỉ đọc từ `os.environ`, **không hardcode giá trị**. Placeholder trong `.example` (`REPLACE_...`, `your_cor...`) không phải secret thật.

**Cần Owner chọn** (không tự làm — purge history ảnh hưởng mọi người đã clone):
1. `git filter-repo` / BFG để gỡ khỏi toàn bộ history, **hoặc**
2. Chấp nhận rủi ro, chỉ rotate secret.

Nếu (1) → phải **force-push + báo mọi người clone lại**. Đây là việc không thể hoàn tác.
Chi tiết: `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 272 §5 · `docs/OPEN_WORK_SEC_20260929.md` OW-01.

### 3.2 Bug KBS cửa sổ 1 ngày (tách ticket riêng, chưa sửa)

`vnbroker_adapter.py:456-461` xin cửa sổ **1 ngày** (`start=today, end=today`), KBS cần **≥2 ngày** → `ValueError` → `fetch_realtime_price` trả `None`.
Đã chứng minh **3.5.0 cũng vậy** ⇒ lỗi có sẵn của vninvest, không phải do nâng version.
Đáng chú ý: source mặc định lại là KBS ⇒ hàm **hỏng theo mặc định**.

### 3.3 Timestamp tick lệch 7 giờ

`vnbroker_adapter.py:993-1000`. Lỗi có sẵn, tồn tại ở mọi version, **không liên quan** PR #109.

### 3.4 Dead code trong CSS (phát hiện ngoài phạm vi, chưa sửa)

`vnadmin.css:3679-3739` còn **6 rule `vn-kpi__*`** — template mới không tham chiếu class nào (`grep` template = 0 hit).
Đây là lý do file dài 3378 dòng. Xoá được nhưng **tách ticket riêng**, không gộp vào PR #110.

---

## 4. Gate chạy THẬT (sau rebase lên `origin/dev`)

| Gate | Kết quả |
|---|---|
| `manage.py check` | exit 0 |
| `makemigrations --check --dry-run` | exit 0 — No changes detected |
| `scripts/check_admin_ux.py` | exit 0 — 0 lỗi, 0 cảnh báo |
| `check_admin_ux.py --self-test` | **25/25** |
| `manage.py test tests.test_admin_ui` | **OK 45/45** |
| **full BE** `manage.py test` | **724 test, OK, exit 0** |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 — 0 error (3786 warning có sẵn) |
| `npm run build` | exit 0 |
| **full FE** `npm run test:components` | **128 file / 918 test PASS** |
| **pre-push-gate** | **21 PASS / 0 SKIP / 0 FAIL** (2 lần: tay + qua hook thật lúc push) |
| `docker compose config --quiet` | exit 0 |
| CI `scan` | **success** |

**Ghi trung thực về flake:** full FE **run 1** = 2 fail trong `tenantreg-auth-pages.component.test.tsx` — file **ngoài** 28 file cứu. Chạy riêng **29/29 PASS** (5s so với 47s khi full) ⇒ **flake tải**, không phải hồi quy. Run 2 + run 3 = **918/918**. Ghi cả 3 lần, không chỉ lần xanh.

---

## 5. CHƯA CHẠY (không suy ra "chắc là được")

- **`ruff`** — không cài trong `.venv`, cần phép cài dependency.
- **Playwright / E2E** — `vite.config.ts` khai `proxy` **chỉ trong `server`**, không có trong `preview`, mà `playwright.config.ts:71` chạy `npm run preview`. Đã ghi ở Entry 270.
- **`LiveBrokerContractTests`** — cần `VNBROKER_RUN_LIVE_CONTRACT=1` + JWT thật.
- **Kiểm bằng trình duyệt** — light/dark, focus ring, vùng chạm 24px, sắc chữ tiếng Việt có dấu.
- **CI billing** — các job khác bị chặn ("recent account payments have failed"); `scan` vẫn chạy. Không riêng repo này.

---

## 6. Bài học để mang sang (quan trọng nhất của phiên)

**Registry `CLAIMS.md` KHÔNG phải bằng chứng commit.** 6 dòng ghi `done` mà **0/6 branch tồn tại**, **0/12 template từng được track**.
Đừng tin cột `status` — hãy chạy:
```bash
git branch --list <ten-branch>          # có thật không
git ls-tree HEAD -- <file>              # file đã vào git chưa
```
Nếu cả hai rỗng ⇒ việc **chưa tồn tại**, dù claim ghi gì.

**Đừng tin cả con số diff.** `git diff --numstat` = 574/574 trên compose, nhưng `--ignore-cr-at-eol` = **11/11**.
Dùng `git ls-files --eol` để **hỏi** file đó dùng LF hay CRLF **trước khi** chuẩn hoá — `vnadmin.css` là CRLF-native, chuẩn hoá nó là sai.

---

## 7. Bản đồ file của PR #110

```
11716afdb  20 file  templates/admin/*.html (12 MỚI) · vnadmin.css · vnadmin-nav.js
                   base/base_site/index/nav_sidebar.html · data_ingest/admin.py
                   tests/test_admin_ui.py · scripts/verify-admin-fixes.mjs
87aeeb580   8 file  PortfolioWorkspace.{tsx,css} · seed_qa_user_dataset.py · 5 docs/*.md
bb76a1e93   1 file  Dockerfile                      (KHÔNG thuộc deny-list)
45bcb74aa   1 file  docker-compose.dev.yml          (deny-list → --no-verify + trailer)
8e8abea54   1 file  CODE_CHANGE_AUDIT_LEDGER.md     Entry 272
04d585485   1 file  CLAIMS.md                       khai claim
b3be07cba   1 file  CLAIMS.md                       đóng claim
```

Rollback: `git revert` từng commit — không commit nào chạm file shared nên tách được.

---

## 8. Việc đầu tiên session sau nên làm

1. **PR #110 đã merge** → codebase sạch. Không cần cleanup worktree (đã xoá khi merge).
2. **Xử lý §3.1 (P0-SEC-01)** — cần Owner quyết định, **không tự purge history**.
3. **Xem danh sách branch cũ còn lại** ở §0 — hỏi Owner trước khi dọn.
4. Đọc `AGENTS.md` mục Progress — nơi duy nhất còn sống.
5. Nạp skill `project-lessons` **trước** khi lập kế hoạch (AGENTS.md mục 0).

### Quy trình đúng khi làm việc mới (đã chứng minh hoạt động phiên này)

```bash
git status --short                      # 1. xem việc chưa commit của agent khác
grep in-progress docs/CLAIMS.md         # 2. ai đang giữ file gì
# 3. khai claim -> commit riêng -> TẠO BRANCH -> code -> gate -> PR
pwsh -File scripts/agent-sync.ps1       # rebase -> check migration -> gate
```

Lưu ý: nhánh cũ đang ở `dev` còn dữ **file uncommitted của người khác**. Đừng bao giờ chạy
`git checkout -- <file>` để "dọn" — nó xoá luôn việc chưa commit (L-A01).
Nếu cần dọn, dùng `git stash push -- <file>` hoặc commit WIP trước.