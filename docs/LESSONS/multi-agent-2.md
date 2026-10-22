# Multi-Agent 2 - Lessons ( moi truong, Docker, tooling pipeline)

> Tach tu `multi-agent.md` (2026-10-22) de **C1** (file goc da 120 dong).
> `tags: [multi-agent, docker, postgres, worktree, tooling, pr, pipeline, environment]`

## L-M05: Docker chet => `new-agent.ps1` FAIL o buoc 2/7, khong co duong "skip DB"

- **Nguyên nhân:** `scripts/new-agent.ps1` buoc 2/7 "tao DB rieng" chay `docker exec vninvest-dev-core-db createdb ...`; Docker Desktop khong khoi dong duoc ("Error response from daemon: Docker Desktop is unable to start") => `createdb` fail => script `Die "tao DB that bai"` => **STOP o buoc 2/7**, khong tao duoc branch/worktree/hook.
- **Hau qua that (2026-10-22):** mat ~20 phong khoi dong Docker + vong doi thu lai; phai lam thu cong 4 buoc (branch -> worktree -> junction -> `sh scripts/agent-install-hooks.sh`) de co agent lam viec. Slice khong sua BE nen buoc DB that su khong can.
- **Khi nao gap:** `tags: [multi-agent, docker, postgres, database, worktree, new-agent, environment]`
- **QUY TAC:** "Docker khong len duoc => `new-agent.ps1` **khong dung duoc**. Khi slice **khong sua BE / khong migration** (FE-only, root scripts, docs): tao worktree **thu cong** va **ghi ro** bo qua buoc DB trong claim + ledger. Khi slice **co sua BE**: **dung** duoc, phai khoi dong lai Docker truoc, khong co duong 'chay thu khong co DB'."
- **CHECKLIST:**
  - [ ] `docker ps` co chay khong? Neu FAIL => Docker/WSL2/Hyper-V dang hong — **sua moi truong truoc**, khong vong lap lai `new-agent.ps1`.
  - [ ] Slice co sua `packages/core/backend/**` hay co migration khong?
    - **Co** => KHONG duoc bo qua DB (BE test can Postgres rieng — `identity_access/9000_auth_user_email_ci_unique.py:60` dung `array_agg` => **khong chay duoc tren SQLite**).
    - **Khong** => duoc bo qua DB, **nhung phai ghi ro** trong claim + ledger.
  - [ ] Da tao thu cong **day du** 4 buoc: `git branch <b> origin/dev` · `git worktree add` · junction 3 duong dan · `sh scripts/agent-install-hooks.sh` + verify `git config --get core.hooksPath` = `.githooks`?
  - [ ] Da ghi "BE test = CHUA CHAY" (khong suy ra "chac la duoc")?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 396 §"CHUA CHAY"; `scripts/new-agent.ps1:83-84` (`docker exec ... createdb` + `Die "tao DB that bai"`).

## L-M06: `scripts/agent-pr.ps1` HONG CU PHAP — Stage 7 cua pipeline khong chay duoc

- **Nguyenn han:** `scripts/agent-pr.ps1:75` mo here-string `@"` nhung **thieu terminator `"@`** => `ParserError: The string is missing the terminator: "@.` => lenh `pwsh -File scripts/agent-pr.ps1` **fail ngay khi parse**, khong tao duoc PR.
- **Hau qua that (2026-10-22):** Stage 7 (Merge) cua skill `multi-agent-workflow` bi chan; phai dung `gh pr create --base dev --head <b> --body-file <file>` thay the, va phai **tu viet body** (bo sung checklist reviewer cua skill: khong deny-list, migration, CHUA CHAY, claim done...).
- **Khi nao gap:** `tags: [multi-agent, tooling, pipeline, pr, powershell, parse-error, script]`
- **QUY TAC:** "**Khong co tool Stage 7 nao chay duoc => dung `gh pr create` truc tiep**, va **tu dua checklist reviewer cua skill vao PR body** (khong bo). Lua chon `gh` khong phai la bo gate: pre-push gate van chay truc tiep bang `node scripts/pre-push-gate.mjs` + `git push --no-verify` chi khi gate do **do moi truong** (L-G08) va **ly do phai nam trong commit body**."
- **CHECKLIST:**
  - [ ] `pwsh -File scripts/agent-pr.ps1` co parse loi khong? Neu co => dung `gh pr create --body-file`.
  - [ ] PR body co **checklist reviewer** (6/7 muc cua skill) khong?
  - [ ] PR body co pre-fill `Pass` cho gate **chua chay** khong? (phai de trong `CHUA CHAY`)
  - [ ] Neu dung `--no-verify` => **ly do da nam trong commit body** chua?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 396 §"PHAT HIEN MOI"; `scripts/agent-pr.ps1:75`.

## L-M07: Gate byte-sensitive (`global-config-drift`) DO o MOI worktree — do lai 3 lan roi moi `--no-verify`

- **Nguyenn han:** `git ls-files --eol`: main tree `w/crlf` (working tree CRLF) vs worktree moi `w/lf` (checkout moi) — **noi dung commit giong nhau** (`i/lf` ca hai) => gate so byte thay doi => DRIFT.
- **Hau qua that (2026-10-22):** `pre-push-gate` FAIL `global-config-drift` trong worktree `w0-foundation`; neu tin ngay vao "do code toi" => hoac sua o file ngoai scope, hoac dung `--no-verify` **ma khong co bang chung**.
- **Khi nao gap:** `tags: [multi-agent, gate, worktree, eol, crlf, drift, no-verify, environment]`
- **QUY TAC:** "Gate FAIL **chi** trong worktree, PASS o main tree => **do lai 3 lan** (L-G08) truoc khi quyet dinh: ① `git ls-files --eol` doi chieu `i/` va `w/` ② worktree **khong sua gi** chay cung gate ③ `dev` sach o main tree chay gate. Cung FAIL => **loi moi truong** => push `--no-verify` + **ly do (do lai) trong commit body**; khong bo gate nao khac."
- **CHECKLIST:**
  - [ ] `git ls-files --eol <file>` tren ca main tree va worktree — `w/` co khac nhau khong? (`crlf` vs `lf`)
  - [ ] `git diff --stat origin/dev...HEAD` co file nao **khac** voi file bi DRIFT khong? (neu KHONG ⇒ khong phai code cua minh)
  - [ ] Da tao worktree **khong sua gi** de chay cung gate chua?
  - [ ] `dev` sach o main tree chay gate => PASS chua?
  - [ ] Ly do (3 bang chung) **da ghi trong commit body** chua?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 396 §"`global-config-drift` FAIL trong worktree"; `docs/LESSONS/build-gates.md` L-G08.

## L-M08: Quy dinh da co san trong repo ma khong DOC — "moi thu nghiem chay tren VPS staging"

- **Nguyenn han:** `docs/STAGING_VPS_RUNBOOK.md` **§12** (Owner chot 2026-10-14) da quy dinh "moi test BE/FE chay tren VPS staging, CAM container local" **tu truoc**. Phiên 2026-10-22 agent **khong doc §12** ⇒ thu khoi dong Docker Desktop local (that bai) ⇒ mat ~20 phong ⇒ BE test phai ghi "CHUA CHAY".
- **Hau qua that:** 1 slice gui report voi gate BE = `CHUA CHAY` **trong khi VPS da co Postgres + image staging + node** ⇒ thu nghiem co the chay duoc ma lai bo qua. Sau khi doc §12, **toan bo gate con CHUA CHAY da chay that tren VPS** (BE full 3453 test · FE vitest 1169/1174 · jest 262/271 · build PASS · lint 0 error) trong <15 phong.
- **Khi nao gap:** `tags: [multi-agent, staging, vps, docker, test, gate, runbook, experiment]`
- **QUY TAC:** "**Truoc khi chay bat ky thu nghiem nao, DOC `docs/STAGING_VPS_RUNBOOK.md` §12.** Neu thu nghiem can Docker/Postgres/RAM-nang ⇒ **chay tren VPS staging** (`ssh -i $HOME/.ssh/id_ed25519 root@14.225.255.47`, repo `/opt/vninvest`), **khong** khoi dong Docker local. Ket thuc thu nghiem ⇒ **drop DB tam, xoa worktree tam, xoa node_modules tam, xac nhan khong con container thu nghiem** (`docker ps`). Gate may: `node scripts/check-experiment-env.mjs` chan dong moi them goi docker ma khong co dau hieu VPS."
- **CHECKLIST:**
  - [ ] Da doc `docs/STAGING_VPS_RUNBOOK.md` §12 truoc khi thu nghiem chua?
  - [ ] Thieu nghiem nay co can Docker/Postgres/RAM-nang khong? => **VPS**.
  - [ ] Neu VPS khong truy cap duoc => ghi "CHUA CHAY" + **ly do cu the** (khong doi thu nghiem sang local docker).
  - [ ] Da **dọn** sau thu nghiem: DB tam DROP · worktree tam remove · node_modules tam xoa · `docker ps` khong con container thu nghiem?
  - [ ] Da ghi bang chong VPS vao ledger (lenh + ket qua + so do) chua?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 397; `docs/STAGING_VPS_RUNBOOK.md` §12; `docs/AGENT_PROTOCOL.md` §12.

## L-V09: Grep theo ĐƯỜNG DẪN DOTTED cho kết quả GIẢ khi code dùng RELATIVE import / include() bằng CHUỖI

- **Nguyên nhân:** `grep "market_data.urls"` trả **0 hit** vì code thật import bằng **relative**: `from .urls import urlpatterns as shared_urlpatterns` (`core_urls.py:39`). Tương tự `include('vninvest_core.contracts.admin_ops.urls')` — grep `"contracts.admin_ops"` (dấu chấm) không match, phải grep **chuỗi** có dấu chấm.
- **Hậu quả thật (2026-10-22):** xoá nhầm `market_data/urls.py` (6 route) ⇒ `ModuleNotFoundError: No module named 'market_data.urls'` ⇒ **toàn bộ endpoint `/core/v1/market-data/*` chết**. Đã khôi phục kịp trước khi merge. Lần trước đó (audit) cùng lỗi với `contracts.admin_ops` ⇒ 26 route "không ai gọi" **nhưng còn sống trong test** (ROOT_URLCONF riêng).
- **Khi nào gặp:** `tags: [verification, grep, dotted-path, relative-import, dead-code, audit, delete, false-negative, baseline]`
- **QUY TẮC:** "**KHÔNG** kết luận 'code chết' bằng grep theo đường dẫn dotted. Tiêu chí đúng là **số reference THẬT**: (a) grep **basename** (không dấu chấm), (b) grep **relative import** `from .X import` / `from .X import (`, (c) grep **chuỗi include()**, (d) grep **tên file** trong mọi `.py` kể cả `tests/`, (e) loại bỏ dòng comment. **Và bắt buộc**: chạy `manage.py check` + **full test suite trên VPS** trước khi commit xoá. Nếu có test **đang đỏ sẵn** liên quan tới file cần xoá ⇒ **KHÔNG xoá** (lưới bảo vệ không hoạt động ⇒ không có bằng chứng an toàn)."
- **CHECKLIST:**
  - [ ] Tôi đã grep **basename** (không dấu chấm) chứ không chỉ dotted path?
  - [ ] Tôi đã grep `from .X import` (relative) và `include('...X...')` (chuỗi)?
  - [ ] Tôi đã grep trong **`tests/`** chứ không chỉ `src/`?
  - [ ] `manage.py check` PASS **trên VPS** (không phải local)?
  - [ ] Full BE suite trên VPS **khớp baseline** (cùng commit, cùng môi trường)?
  - [ ] Có test nào **đang đỏ sẵn** liên quan tới file cần xoá không? ⇒ nếu có ⇒ **KHÔNG xoá**
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 402; `packages/core/backend/src/market_data/core_urls.py:39`; `packages/core/backend/tests/test_admin_ops_contract_api.py:55`.
