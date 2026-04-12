# PREFETCH TIME POLICY - BRANCHING & COMMIT GUIDE (2026-04-12)

## 1) Branch naming

Pattern:
- `feature/prefetch-policy-pr1-schema-validator`
- `feature/prefetch-policy-pr2-resolver-task`
- `feature/prefetch-policy-pr3-guard-metrics`
- `feature/prefetch-policy-pr4-adminops-form`
- `feature/prefetch-policy-pr5-validation-preview`
- `feature/prefetch-policy-pr6-test-rollout-docs`

Rules:
- 1 branch = 1 PR slice.
- Khong gop nhieu slice vao cung branch.

---

## 2) Commit convention

Pattern:
- `feat(prefetch-policy): add runtime policy validator`
- `test(prefetch-policy): add resolver boundary tests`
- `docs(prefetch-policy): add rollout gate checklist`
- `fix(prefetch-policy): clamp multiplier interval`

Rules:
- Commit nho, co y nghia ro.
- Moi commit phai pass lint/test toi thieu phan lien quan.

---

## 3) PR hygiene

Bat buoc moi PR:
- Link toi draft file tuong ung.
- Dung checklist template dung PR.
- Co test evidence.
- Co risk va rollback note.
- Khong vuot 300-500 LOC neu co the.

---

## 4) Merge strategy

- Prefer squash merge de lich su gon.
- Merge theo thu tu dependency:
  1. PR-1
  2. PR-2
  3. PR-3
  4. PR-4
  5. PR-5
  6. PR-6

---

## 5) Hotfix rule

Neu can hotfix trong sprint:
- Branch: `hotfix/prefetch-policy-<short-desc>`
- PR tach rieng, khong tron vao PR dang mo.
- Cap nhat decision log neu thay doi huong ky thuat.

---

## 6) Done criteria truoc merge

- [ ] Scope dung voi PR slice.
- [ ] Checklist PR da tick.
- [ ] Test pass.
- [ ] Docs/Tracker cap nhat.
- [ ] Reviewer sign-off day du.
