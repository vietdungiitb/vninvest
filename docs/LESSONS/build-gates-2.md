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
