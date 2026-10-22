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
