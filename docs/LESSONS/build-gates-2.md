# BUILD-GATES-2 - Lessons (tiep) (gate, merge conflict, hook)

> Tach tu `build-gates.md` 2026-10-21 khi file do vuot **C1 (120 dong)**.
> **KHONG gop entry cu** — chi chuyen entry moi sang day (C1: tach file moi).

## L-G09: Ghep conflict TAY co the lam hong gate — "push thanh cong" KHONG chung minh gate da chay

- **Nguyen nhan:** Ghep conflict bang script (noi `ours` + `theirs` + `tail`) ⇒ phan duoi file bi nhung **mot doan rac** ⇒ file JS **hong cum phap** ⇒ `node file.mjs` crash ⇒ hook bao loi nhung **push van duoc cho qua** ⇒ gate **KHONG chay** ma ta van tin la "da gate".
- **Hau qua that (Entry 391, 2026-10-21):** `scripts/pre-push-gate.mjs` hong tu commit `1fe43761c` (merge W1, ghep conflict tay) ⇒ **cac push sau do KHONG duoc gate that** (false green) ⇒ phat hien muon khi push branch khac, hook bao `SyntaxError: Unexpected end of input` tai dong 522.
- **Khi nao gap:** `tags: [gate, merge, conflict, syntax, false-green, xanh-gia, push, hook, pre-push]`
- **QUY TAC:** "Sau moi lan ghep conflict **TAY** (khong dung `git merge`/GUI): (1) `node --check` **MOI file script** da cham, (2) chay lai gate, (3) `git diff` kiem tra **duoi file** co duong rac khong. **'Push thanh cong' KHONG chung minh gate da chay** — gate co the da chet trong im lang."
- **CHECKLIST:**
  - [ ] Moi file `.mjs`/script trong vung conflict da qua `node --check` (exit 0)?
  - [ ] `git diff` coi **duoi file** co duong rac (`"..."`, `,` lon loi) khong?
  - [ ] Gate da **chay lai** va in day so gate PASS (khong phai chi "push OK")?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 391 §"SU CO NGHIEM TRONG"; fix `b45b9c8ed`.

## L-G10: Parser gate tu viet phai string-aware — `/*` trong string literal gay PASS gia che ca chuc loi that

- **Nguyen nhan:** Gate `check-page-registry.mjs` loai comment bang regex `/\/\*[\s\S]*?\*\//` — no khop `/*` NAM TRONG string literal (`'whale-alerts/*'` o main.tsx). Regex nuot tu `/*` do den `*/` tiep theo => **nua file bien mat** (20294 → 10084 ky tu) => chi dem 26/67 route => **PASS gia trong khi runtime in 40 dong "Could not resolve page component"**.
- **Hau qua that (Entry 508, 2026-11-15):** 40 route (`ai-traces`, `admin-users`, `tenant-admin-*`, `core-stock-detail`...) khong co registry entry — crash trang "Khong tim thay trang" — nhung gate bao PASS xanh. Phat hien bang Playwright + dem tay, khong phai bang gate.
- **Khi nao gap:** `tags: [gate, parser, regex, string, false-green, comment, self-test]`
- **QUY TAC:** "Parser tu viet (strip comment, dem control, tach log) phai **string-aware**: bao ve `'...'`, `"..."`, `` `...` `` truoc khi ap regex comment. Va phai co **control tren code cu**: chay parser moi tren HEAD cu — neu khong bat duoc loi da biet thi parser vo dung."
- **CHECKLIST:**
- [ ] Regex comment co the cham vao string literal khong? (tim `/*`, `//` trong codebase xem co nam trong quote khong)
- [ ] Da chay **control**: parser moi tren code cu (co loi that) => co bat duoc loi khong?
- [ ] Self-test co case string-chua-comment khong? (neu khong => them)
- [ ] So luong dem duoc co khop voi `grep` doc lap khong? (26 vs 67 la do ngay)
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 508 (control: parser moi bat du 40 dangling tren HEAD cu; self-test 9/9 van xanh).
